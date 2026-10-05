import { SERVICES, MODULES, ROLE_CAPABILITIES, can, userCapabilities, visibleCatalog } from './catalog.js';
import { collectOverview, collectHealth, collectPending, globalSearch, collectSecurity, collectDataQuality, safeAll } from './data.js';
import { CORE_SCHEMA_STATEMENTS } from './schema.js';
import {
  randomToken, sha256, hashPassword, verifyPassword, parseCookies, sessionCookie, clearSessionCookie,
  json, readJson, ipHash, nowIso, addDaysIso, requireSameOrigin, sanitizeText, normalizeEmail, withHeaders
} from './security.js';

const SESSION_COOKIE = 'ops_session';
const VALID_ROLES = Object.keys(ROLE_CAPABILITIES);

const readyDatabases = new WeakSet();
async function ensureOpsSchema(env) {
  if (env?.OPS_DB && readyDatabases.has(env.OPS_DB)) return;
  if (!env?.OPS_DB) throw Object.assign(new Error('OPS_DB_BINDING_MISSING'), { status: 503 });
  const prepared = CORE_SCHEMA_STATEMENTS.map(sql => env.OPS_DB.prepare(sql));
  if (prepared.length) await env.OPS_DB.batch(prepared);

  // Runtime-safe additive upgrades for databases created by older releases.
  // CREATE TABLE IF NOT EXISTS does not add newly introduced columns.
  const userCols = await env.OPS_DB.prepare(`PRAGMA table_info(ops_users)`).all();
  const names = new Set((userCols?.results || []).map(x => x.name));
  if (!names.has('must_change_password')) {
    await env.OPS_DB.prepare(`ALTER TABLE ops_users ADD COLUMN must_change_password INTEGER NOT NULL DEFAULT 0`).run();
  }
  readyDatabases.add(env.OPS_DB);
}

async function sourceReadiness(env){const dbs=[['OPS_DB','ops'],['SLC_DB','slc'],['MEMBER_DB','member'],['TNV_DB','tnv'],['CTT_DB','ctt'],['WEB_DB','web'],['SFEC_DB','sfec'],['MAIL_DB','mail']];const services=[];for(const [bindingName,service] of dbs){const db=env?.[bindingName];if(!db){services.push({service,ok:false});continue;}try{const row=await db.prepare('SELECT 1 AS ok').first();services.push({service,ok:Number(row?.ok||0)===1});}catch{services.push({service,ok:false});}}services.push({service:'exam',ok:Boolean(services.find(x=>x.service==='slc')?.ok),shared_with:'slc'});let storage={ok:Boolean(env?.OPS_R2)};if(env?.OPS_R2){try{await env.OPS_R2.list({limit:1});storage={ok:true};}catch{storage={ok:false};}}return {services,storage,ready:services.every(x=>x.ok)&&storage.ok};}

function requireRead(result){if(!result.ok) throw Object.assign(new Error('SOURCE_UNAVAILABLE'),{status:503});return result.data;}
function accessFingerprint(user){return JSON.stringify(userCapabilities(user).slice().sort());}
function routeMatch(path, prefix) { return path === prefix || path.startsWith(prefix + '/'); }
function uuid() { return crypto.randomUUID(); }

async function audit(env, request, user, action, targetType = null, targetId = null, metadata = {}) {
  try {
    await env.OPS_DB.prepare(`INSERT INTO ops_audit_logs
      (id, actor_user_id, actor_email, action, target_type, target_id, metadata_json, ip_hash, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .bind(uuid(), user?.id || null, user?.email || null, action, targetType, targetId, JSON.stringify(metadata || {}), await ipHash(request), nowIso()).run();
  } catch {console.error('OPS_AUDIT_WRITE_FAILED');}
}

async function getUser(request, env, { touch = true } = {}) {
  const token = parseCookies(request)[SESSION_COOKIE];
  if (!token) return null;
  const tokenHash = await sha256(token);
  const row = await env.OPS_DB.prepare(`SELECT u.*, s.id AS session_id, s.csrf_token, s.expires_at
    FROM ops_sessions s JOIN ops_users u ON u.id=s.user_id
    WHERE s.token_hash=? AND s.expires_at > ? AND u.status='active' LIMIT 1`)
    .bind(tokenHash, nowIso()).first();
  if (!row) return null;
  if (touch) {
    try { await env.OPS_DB.prepare(`UPDATE ops_sessions SET last_seen_at=? WHERE id=?`).bind(nowIso(), row.session_id).run(); } catch {}
  }
  return row;
}

function publicUser(user) {
  return user ? {
    id: user.id,
    email: user.email,
    full_name: user.full_name,
    role: user.role,
    must_change_password: Boolean(user.must_change_password),
    capabilities: userCapabilities(user),
    csrf_token: user.csrf_token
  } : null;
}

function requireCap(user, capability) {
  if (!user) throw Object.assign(new Error('AUTH_REQUIRED'), { status: 401 });
  if (!can(user, capability)) throw Object.assign(new Error('FORBIDDEN'), { status: 403 });
}

function requireCsrf(request, user) {
  if (!requireSameOrigin(request)) throw Object.assign(new Error('BAD_ORIGIN'), { status: 403 });
  const token = request.headers.get('x-csrf-token') || '';
  if (!user?.csrf_token || token !== user.csrf_token) throw Object.assign(new Error('CSRF_INVALID'), { status: 403 });
}

async function setupStatus(env) {
  await ensureOpsSchema(env);
  const row = await env.OPS_DB.prepare(`SELECT COUNT(*) AS n FROM ops_users`).first();
  return { initialized: Number(row?.n || 0) > 0 };
}

async function bootstrap(request, env) {
  await ensureOpsSchema(env);
  if (!env.SETUP_SECRET) return json({ ok:false, error:'SETUP_DISABLED' }, 403);
  if ((request.headers.get('x-setup-secret') || '') !== env.SETUP_SECRET) return json({ ok:false, error:'SETUP_SECRET_INVALID' }, 403);
  const status = await setupStatus(env);
  if (status.initialized) return json({ ok:false, error:'ALREADY_INITIALIZED' }, 409);
  const body = await readJson(request);
  const email = normalizeEmail(body.email);
  const fullName = sanitizeText(body.full_name, 120);
  const password = String(body.password || '');
  if (!email.includes('@') || fullName.length < 2 || password.length < 12) return json({ ok:false, error:'INVALID_BOOTSTRAP_DATA' }, 400);
  let hp;
  try {
    hp = await hashPassword(password);
  } catch (e) {
    console.error('OPS_PASSWORD_HASH_FAILED', e?.stack || e);
    throw Object.assign(new Error('PASSWORD_HASH_FAILED'), { status: 500 });
  }
  const id = uuid(); const now = nowIso();
  try {
    const inserted = await env.OPS_DB.prepare(`INSERT INTO ops_users
    (id,email,full_name,role,capabilities_json,password_hash,password_salt,password_iterations,status,created_at,updated_at)
    SELECT ?,?,?,?,?,?,?,?,?,?,? WHERE NOT EXISTS (SELECT 1 FROM ops_users)`)
    .bind(id,email,fullName,'super_admin','[]',hp.hash,hp.salt,hp.iterations,'active',now,now).run();
    if (!inserted.meta?.changes) return json({ok:false,error:'ALREADY_INITIALIZED'},409);
  } catch (e) {
    console.error('OPS_BOOTSTRAP_INSERT_FAILED', e?.stack || e);
    throw Object.assign(new Error('BOOTSTRAP_DB_WRITE_FAILED'), { status: 500 });
  }
  await audit(env, request, {id,email}, 'ops.bootstrap', 'user', id, { role:'super_admin' });
  return json({ ok:true, user:{id,email,full_name:fullName,role:'super_admin'} }, 201);
}

async function checkLoginRate(env, key) {
  const now = Date.now();
  const row = await env.OPS_DB.prepare(`SELECT * FROM ops_login_attempts WHERE key=?`).bind(key).first();
  if (row?.blocked_until && Date.parse(row.blocked_until) > now) return { allowed:false, retry_after:Math.ceil((Date.parse(row.blocked_until)-now)/1000) };
  return { allowed:true };
}

async function recordLoginFailure(env, key) {
  const now=nowIso(),cutoff=new Date(Date.now()-15*60*1000).toISOString(),blocked=new Date(Date.now()+15*60*1000).toISOString();
  await env.OPS_DB.prepare(`INSERT INTO ops_login_attempts(key,count,window_started_at,blocked_until) VALUES(?,1,?,NULL)
    ON CONFLICT(key) DO UPDATE SET
    count=CASE WHEN window_started_at>? THEN count+1 ELSE 1 END,
    blocked_until=CASE WHEN window_started_at>? AND count+1>=7 THEN ? ELSE NULL END,
    window_started_at=CASE WHEN window_started_at>? THEN window_started_at ELSE excluded.window_started_at END`)
    .bind(key,now,cutoff,cutoff,blocked,cutoff).run();
}

async function login(request, env) {
  await ensureOpsSchema(env);
  const body = await readJson(request);
  const email = normalizeEmail(body.email);
  const password = String(body.password || '');
  const ip = await ipHash(request);
  const key = await sha256(`${email}|${ip}`);
  const ipKey='ip:'+ip;
  const ipRate=await checkLoginRate(env,ipKey);
  if(!ipRate.allowed)return json({ok:false,error:'LOGIN_RATE_LIMIT',retry_after:ipRate.retry_after},429);
  const rate = await checkLoginRate(env, key);
  if (!rate.allowed) return json({ ok:false, error:'LOGIN_RATE_LIMIT', retry_after:rate.retry_after }, 429);
  const user = await env.OPS_DB.prepare(`SELECT * FROM ops_users WHERE email=? COLLATE NOCASE LIMIT 1`).bind(email).first();
  if (!user || user.status !== 'active' || !(await verifyPassword(password, user))) {
    await recordLoginFailure(env,key);
    await recordLoginFailure(env,ipKey);
    await audit(env,request,{email},'auth.login_failed','user',user?.id||null,{});
    return json({ ok:false, error:'LOGIN_INVALID' }, 401);
  }
  try { await env.OPS_DB.prepare(`DELETE FROM ops_login_attempts WHERE key=?`).bind(key).run(); } catch {}
  const token = randomToken(32), tokenHash = await sha256(token), csrf = randomToken(24);
  const configuredDays=Number(env.SESSION_DAYS||14);
  const days = Number.isFinite(configuredDays)?Math.min(30,Math.max(1,configuredDays)):14;
  const now=nowIso(), exp=addDaysIso(days), sid=uuid();
  await env.OPS_DB.prepare(`INSERT INTO ops_sessions(id,user_id,token_hash,csrf_token,expires_at,created_at,last_seen_at,user_agent,ip_hash)
    VALUES(?,?,?,?,?,?,?,?,?)`).bind(sid,user.id,tokenHash,csrf,exp,now,now,(request.headers.get('user-agent')||'').slice(0,500),ip).run();
  await env.OPS_DB.prepare(`UPDATE ops_users SET last_login_at=?, updated_at=? WHERE id=?`).bind(now,now,user.id).run();
  await audit(env,request,user,'auth.login','session',sid,{});
  return json({ ok:true, user:{...publicUser({...user,csrf_token:csrf}),csrf_token:csrf} },200,{'set-cookie':sessionCookie(token,days*86400)});
}

async function logout(request, env, user) {
  if (user?.session_id) {
    try { await env.OPS_DB.prepare(`DELETE FROM ops_sessions WHERE id=?`).bind(user.session_id).run(); } catch {}
    await audit(env,request,user,'auth.logout','session',user.session_id,{});
  }
  return json({ok:true},200,{'set-cookie':clearSessionCookie()});
}

function friendlyError(e) {
  const rawCode = String(e?.message || 'INTERNAL_ERROR');
  const code = /^[A-Z][A-Z_]+$/.test(rawCode)?rawCode:'INTERNAL_ERROR';
  const known = {
    AUTH_REQUIRED:'Bạn cần đăng nhập.', FORBIDDEN:'Bạn không có quyền thực hiện thao tác này.',
    CSRF_INVALID:'Phiên bảo mật không hợp lệ. Vui lòng tải lại trang.', BAD_ORIGIN:'Yêu cầu không hợp lệ.',
    INVALID_JSON:'Dữ liệu gửi lên không hợp lệ.', PAYLOAD_TOO_LARGE:'Dữ liệu gửi lên quá lớn.',
    PASSWORD_HASH_FAILED:'Chưa thể tạo thông tin đăng nhập. Vui lòng thử lại hoặc liên hệ hỗ trợ.',
    BOOTSTRAP_DB_WRITE_FAILED:'Chưa thể tạo tài khoản quản trị. Vui lòng thử lại hoặc liên hệ hỗ trợ.',
    SOURCE_UNAVAILABLE:'Nguồn dữ liệu tạm thời không khả dụng.',
    OPS_DB_BINDING_MISSING:'Chưa thể kết nối dữ liệu vận hành. Vui lòng liên hệ quản trị hệ thống.'
  };
  return { code, message:known[code] || 'Không thể hoàn tất yêu cầu lúc này.' };
}

async function incidentsApi(request, env, user, url) {
  if (request.method === 'GET') {
    requireCap(user,'incidents.view');
    const r = await safeAll(env.OPS_DB,`SELECT * FROM ops_incidents ORDER BY CASE status WHEN 'open' THEN 0 WHEN 'investigating' THEN 1 ELSE 2 END, created_at DESC LIMIT 200`);
    return json({ok:true,items:requireRead(r)});
  }
  requireCap(user,'incidents.manage'); requireCsrf(request,user);
  if (request.method === 'POST') {
    const b=await readJson(request), id=uuid(), now=nowIso();
    const title=sanitizeText(b.title,180), severity=['low','medium','high','critical'].includes(b.severity)?b.severity:'medium';
    if (!title) return json({ok:false,error:'TITLE_REQUIRED'},400);
    await env.OPS_DB.prepare(`INSERT INTO ops_incidents(id,title,severity,status,service_id,description,owner_user_id,started_at,created_by,created_at,updated_at)
      VALUES(?,?,?,?,?,?,?,?,?,?,?)`).bind(id,title,severity,'open',sanitizeText(b.service_id,40)||null,sanitizeText(b.description,3000)||null,b.owner_user_id||null,now,user.id,now,now).run();
    await audit(env,request,user,'incident.create','incident',id,{severity});
    return json({ok:true,id},201);
  }
  if (request.method === 'PATCH') {
    const b=await readJson(request), id=sanitizeText(b.id,80), status=['open','investigating','monitoring','resolved'].includes(b.status)?b.status:null;
    if (!id||!status) return json({ok:false,error:'INVALID_INCIDENT'},400);
    if(!await env.OPS_DB.prepare('SELECT id FROM ops_incidents WHERE id=?').bind(id).first()) return json({ok:false,error:'NOT_FOUND'},404);
    await env.OPS_DB.prepare(`UPDATE ops_incidents SET status=?, resolved_at=CASE WHEN ?='resolved' THEN ? ELSE NULL END, updated_at=? WHERE id=?`)
      .bind(status,status,nowIso(),nowIso(),id).run();
    await audit(env,request,user,'incident.update','incident',id,{status});
    return json({ok:true});
  }
  return json({ok:false,error:'METHOD_NOT_ALLOWED'},405);
}

async function alertsApi(request, env, user) {
  if (request.method==='GET') {
    requireCap(user,'alerts.view');
    const r=await safeAll(env.OPS_DB,`SELECT * FROM ops_alerts ORDER BY CASE severity WHEN 'critical' THEN 0 WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END, created_at DESC LIMIT 250`);
    return json({ok:true,items:requireRead(r)});
  }
  requireCap(user,'alerts.manage'); requireCsrf(request,user);
  if (request.method==='PATCH') {
    const b=await readJson(request), id=sanitizeText(b.id,80);
    if(!id) return json({ok:false,error:'ID_REQUIRED'},400);
    const alertRow=await env.OPS_DB.prepare('SELECT status FROM ops_alerts WHERE id=?').bind(id).first();
    if(!alertRow) return json({ok:false,error:'NOT_FOUND'},404);
    if(alertRow.status==='resolved') return json({ok:false,error:'ALREADY_RESOLVED'},409);
    await env.OPS_DB.prepare(`UPDATE ops_alerts SET status='acknowledged', acknowledged_by=?, acknowledged_at=?, updated_at=? WHERE id=?`).bind(user.id,nowIso(),nowIso(),id).run();
    await audit(env,request,user,'alert.acknowledge','alert',id,{});
    return json({ok:true});
  }
  return json({ok:false,error:'METHOD_NOT_ALLOWED'},405);
}

async function usersApi(request, env, user) {
  requireCap(user,'ops.users.manage');
  // Only the root role may delegate roles or capabilities.
  if (request.method!=='GET' && user.role!=='super_admin') return json({ok:false,error:'FORBIDDEN'},403);
  if (request.method==='GET') {
    const r=await safeAll(env.OPS_DB,`SELECT id,email,full_name,role,capabilities_json,status,must_change_password,created_at,updated_at,last_login_at FROM ops_users ORDER BY created_at DESC`);
    return json({ok:true,items:requireRead(r)});
  }
  requireCsrf(request,user);
  if (request.method==='POST') {
    const b=await readJson(request), email=normalizeEmail(b.email), name=sanitizeText(b.full_name,120), role=VALID_ROLES.includes(b.role)?b.role:'viewer', password=String(b.password||'');
    if(!email.includes('@')||name.length<2||password.length<12) return json({ok:false,error:'INVALID_USER_DATA'},400);
    const hp=await hashPassword(password), id=uuid(), now=nowIso();
    try {
      await env.OPS_DB.prepare(`INSERT INTO ops_users(id,email,full_name,role,capabilities_json,password_hash,password_salt,password_iterations,status,must_change_password,created_at,updated_at)
        VALUES(?,?,?,?,?,?,?,?,?,?,?,?)`).bind(id,email,name,role,JSON.stringify(Array.isArray(b.capabilities)?b.capabilities:[]),hp.hash,hp.salt,hp.iterations,'active',1,now,now).run();
    } catch(e) { return json({ok:false,error:'USER_CREATE_FAILED'},409); }
    await audit(env,request,user,'ops_user.create','user',id,{email,role});
    return json({ok:true,id},201);
  }
  if (request.method==='PATCH') {
    const b=await readJson(request), id=sanitizeText(b.id,80), role=VALID_ROLES.includes(b.role)?b.role:null, status=['active','disabled'].includes(b.status)?b.status:null;
    if(!id) return json({ok:false,error:'ID_REQUIRED'},400);
    const target=await env.OPS_DB.prepare(`SELECT id,role,status FROM ops_users WHERE id=? LIMIT 1`).bind(id).first();
    if(!target) return json({ok:false,error:'USER_NOT_FOUND'},404);
    if(id===user.id && ((role && role!==user.role) || Array.isArray(b.capabilities))) return json({ok:false,error:'CANNOT_CHANGE_OWN_ACCESS'},400);
    if(id===user.id && status==='disabled') return json({ok:false,error:'CANNOT_DISABLE_SELF'},400);
    if(target.role==='super_admin' && (status==='disabled' || (role && role!=='super_admin'))) {
      const row=await env.OPS_DB.prepare(`SELECT COUNT(*) AS n FROM ops_users WHERE role='super_admin' AND status='active'`).first();
      if(Number(row?.n||0)<=1) return json({ok:false,error:'LAST_SUPER_ADMIN'},400);
    }
    const caps=Array.isArray(b.capabilities)?JSON.stringify(b.capabilities):null;
    await env.OPS_DB.prepare(`UPDATE ops_users SET role=COALESCE(?,role), status=COALESCE(?,status), capabilities_json=COALESCE(?,capabilities_json), updated_at=? WHERE id=?`)
      .bind(role,status,caps,nowIso(),id).run();
    if(status==='disabled' || role || caps!==null) await env.OPS_DB.prepare(`DELETE FROM ops_sessions WHERE user_id=?`).bind(id).run();
    await audit(env,request,user,'ops_user.update','user',id,{role,status});
    return json({ok:true});
  }
  return json({ok:false,error:'METHOD_NOT_ALLOWED'},405);
}

async function reportSnapshot(request, env, user) {
  requireCap(user,'reports.manage'); requireCsrf(request,user);
  const payload = { overview:await collectOverview(env,user), health:await collectHealth(user), pending:await collectPending(env,user), generated_at:nowIso(), generated_by:user.email, access_fingerprint:accessFingerprint(user) };
  const id=uuid(), now=nowIso(), key=`reports/${now.slice(0,10)}/${id}.json`;
  await env.OPS_DB.prepare(`INSERT INTO ops_kpi_snapshots(id,captured_at,payload_json,created_at) VALUES(?,?,?,?)`).bind(id,now,JSON.stringify(payload),now).run();
  let archived=false;
  if (env.OPS_R2) {try{await env.OPS_R2.put(key,JSON.stringify(payload,null,2),{httpMetadata:{contentType:'application/json'}});archived=true;}catch(e){console.error('OPS_ARCHIVE_FAILED');}}
  await audit(env,request,user,'report.snapshot','report',id,{key});
  return json({ok:true,id,key:archived?key:null,archived,captured_at:now},201);
}

async function scheduledSnapshot(env) {
  await ensureOpsSchema(env);
  const fakeUser={role:'super_admin',capabilities_json:'[]'};
  const health=await collectHealth(fakeUser);
  const payload={overview:await collectOverview(env,fakeUser),health,data_quality:await collectDataQuality(env,fakeUser),generated_at:nowIso(),automated:true};
  const id=uuid(), now=nowIso(), key=`snapshots/${now.slice(0,10)}/${id}.json`;
  await env.OPS_DB.prepare(`INSERT INTO ops_kpi_snapshots(id,captured_at,payload_json,created_at) VALUES(?,?,?,?)`).bind(id,now,JSON.stringify(payload),now).run();
  if(env.OPS_R2){try{await env.OPS_R2.put(key,JSON.stringify(payload,null,2),{httpMetadata:{contentType:'application/json'}});}catch{console.error('OPS_ARCHIVE_FAILED');}}
  for (const item of health.services || []) {
    if (item.probe?.ok) {
      try { await env.OPS_DB.prepare(`UPDATE ops_alerts SET status='resolved', updated_at=? WHERE source='health' AND alert_key=? AND status!='resolved'`).bind(now,`service:${item.service.id}`).run(); } catch {console.error('OPS_ALERT_RESOLVE_FAILED');}
    } else {
      try { await env.OPS_DB.prepare(`INSERT INTO ops_alerts(id,source,alert_key,severity,title,detail,status,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?) ON CONFLICT(source,alert_key) WHERE alert_key IS NOT NULL DO UPDATE SET severity=excluded.severity,title=excluded.title,detail=excluded.detail,status=CASE WHEN ops_alerts.status='resolved' THEN 'open' ELSE ops_alerts.status END,updated_at=excluded.updated_at`).bind(uuid(),'health',`service:${item.service.id}`,'high',`${item.service.name} không phản hồi bình thường`,JSON.stringify(item.probe||{}),'open',now,now).run(); } catch {console.error('OPS_ALERT_UPSERT_FAILED');}
    }
  }
}

async function api(request, env) {
  const url=new URL(request.url), path=url.pathname;
  if (!['GET','HEAD','OPTIONS'].includes(request.method) && !requireSameOrigin(request)) return json({ok:false,error:'BAD_ORIGIN'},403);
  if (path!=='/api/health') await ensureOpsSchema(env);
  if (path==='/api/health' && request.method==='GET') return json({ok:true,service:'Trung tâm Điều hành Sky First'});
  if (path==='/api/setup/status' && request.method==='GET') return json({ok:true,...await setupStatus(env)});
  if (path==='/api/setup/bootstrap' && request.method==='POST') return bootstrap(request,env);
  if (path==='/api/auth/login' && request.method==='POST') return login(request,env);

  const user=await getUser(request,env);
  if (path==='/api/auth/me' && request.method==='GET') return user?json({ok:true,user:publicUser(user)}):json({ok:false,error:'AUTH_REQUIRED'},401);
  if (path==='/api/auth/logout' && request.method==='POST') { if(user) requireCsrf(request,user); return logout(request,env,user); }
  if (!user) return json({ok:false,error:'AUTH_REQUIRED'},401);
  if (user.must_change_password && path!=='/api/auth/change-password') return json({ok:false,error:'PASSWORD_CHANGE_REQUIRED'},403);
  if (path==='/api/auth/change-password' && request.method==='POST') {
    requireCsrf(request,user);
    const b=await readJson(request), current=String(b.current_password||''), next=String(b.new_password||'');
    if(next.length<12) return json({ok:false,error:'PASSWORD_TOO_SHORT'},400);
    if(!(await verifyPassword(current,user))) return json({ok:false,error:'CURRENT_PASSWORD_INVALID'},400);
    if(current===next) return json({ok:false,error:'PASSWORD_UNCHANGED'},400);
    const hp=await hashPassword(next), now=nowIso();
    await env.OPS_DB.prepare(`UPDATE ops_users SET password_hash=?,password_salt=?,password_iterations=?,must_change_password=0,updated_at=? WHERE id=?`).bind(hp.hash,hp.salt,hp.iterations,now,user.id).run();
    await env.OPS_DB.prepare(`DELETE FROM ops_sessions WHERE user_id=? AND id<>?`).bind(user.id,user.session_id).run();
    await audit(env,request,user,'auth.password_change','user',user.id,{});
    const refreshed={...user,password_hash:hp.hash,password_salt:hp.salt,password_iterations:hp.iterations,must_change_password:0};
    return json({ok:true,user:publicUser(refreshed)});
  }

  if (path==='/api/overview' && request.method==='GET') { requireCap(user,'overview.view'); return json({ok:true,data:await collectOverview(env,user)}); }
  if (path==='/api/catalog' && request.method==='GET') return json({ok:true,services:SERVICES.filter(s=>visibleCatalog(user).some(x=>x.system===s.id)),modules:visibleCatalog(user)});
  if (path==='/api/services/health' && request.method==='GET') { requireCap(user,'health.view'); return json({ok:true,data:await collectHealth(user)}); }
  if (path==='/api/pending' && request.method==='GET') { requireCap(user,'overview.view'); return json({ok:true,...await collectPending(env,user)}); }
  if (path==='/api/search' && request.method==='GET') { requireCap(user,'search.global'); return json({ok:true,items:await globalSearch(env,user,url.searchParams.get('q')||'')}); }
  if (path==='/api/security' && request.method==='GET') { if(!(can(user,'security.view')||can(user,'security.*'))) throw Object.assign(new Error('FORBIDDEN'),{status:403}); return json({ok:true,data:await collectSecurity(env,user)}); }
  if (path==='/api/data-quality' && request.method==='GET') { if(!(can(user,'dataquality.view')||can(user,'*.view'))) throw Object.assign(new Error('FORBIDDEN'),{status:403}); return json({ok:true,data:await collectDataQuality(env,user)}); }
  if (path==='/api/incidents') return incidentsApi(request,env,user,url);
  if (path==='/api/alerts') return alertsApi(request,env,user);
  if (path==='/api/admin/users') return usersApi(request,env,user);
  if (path==='/api/audit' && request.method==='GET') {
    if(!(can(user,'audit.view')||can(user,'audit.*'))) throw Object.assign(new Error('FORBIDDEN'),{status:403});
    const r=await safeAll(env.OPS_DB,`SELECT id,actor_email,action,target_type,target_id,metadata_json,created_at FROM ops_audit_logs ORDER BY created_at DESC LIMIT 300`);
    return json({ok:true,items:requireRead(r)});
  }
  if (path==='/api/reports/snapshot' && request.method==='POST') return reportSnapshot(request,env,user);
  if (path==='/api/reports/snapshots' && request.method==='GET') {
    requireCap(user,'reports.view'); const r=await safeAll(env.OPS_DB,`SELECT id,captured_at,created_at FROM ops_kpi_snapshots WHERE ?='super_admin' OR (json_extract(payload_json,'$.generated_by')=? AND json_extract(payload_json,'$.access_fingerprint')=?) ORDER BY captured_at DESC LIMIT 120`,[user.role,user.email,accessFingerprint(user)]); return json({ok:true,items:requireRead(r)});
  }
  if (path.startsWith('/api/reports/snapshots/') && request.method==='GET') {
    requireCap(user,'reports.view');
    const row=await env.OPS_DB.prepare('SELECT * FROM ops_kpi_snapshots WHERE id=?').bind(path.split('/').pop()).first();
    if(!row) return json({ok:false,error:'NOT_FOUND'},404);
    const payload=JSON.parse(row.payload_json);
    if(user.role!=='super_admin' && (payload.generated_by!==user.email || payload.access_fingerprint!==accessFingerprint(user))) return json({ok:false,error:'FORBIDDEN'},403);
    delete payload.access_fingerprint;
    return json({ok:true,data:payload});
  }
  if (path==='/api/auth/sessions' && request.method==='GET') {
    const rows=await env.OPS_DB.prepare('SELECT id,user_agent,created_at,last_seen_at,expires_at FROM ops_sessions WHERE user_id=? AND expires_at>? ORDER BY last_seen_at DESC').bind(user.id,nowIso()).all();
    return json({ok:true,items:rows.results.map(x=>({...x,current:x.id===user.session_id}))});
  }
  if (path==='/api/auth/sessions' && request.method==='DELETE') {
    requireCsrf(request,user); const b=await readJson(request);
    if(!b.id || b.id===user.session_id) return json({ok:false,error:'INVALID_SESSION'},400);
    await env.OPS_DB.prepare('DELETE FROM ops_sessions WHERE user_id=? AND id=?').bind(user.id,b.id).run();
    await audit(env,request,user,'auth.session_revoke','session',b.id);
    return json({ok:true});
  }
  if (path==='/api/system/readiness' && request.method==='GET') {
    requireCap(user,'ops.integrations.view');
    return json({ok:true,data:await sourceReadiness(env)});
  }
  if (path==='/api/system/integrations' && request.method==='GET') {
    requireCap(user,'ops.integrations.view');
    return json({ok:true,items:SERVICES.map(s=>({id:s.id,name:s.name}))});
  }
  if (path==='/api/roles' && request.method==='GET') {
    requireCap(user,'ops.users.manage'); return json({ok:true,roles:Object.keys(ROLE_CAPABILITIES),role_capabilities:ROLE_CAPABILITIES});
  }
  return json({ok:false,error:'NOT_FOUND'},404);
}

export default {
  async fetch(request, env) {
    try {
      const url=new URL(request.url);
      if (url.pathname.startsWith('/api/')) return await api(request,env);
      const response=await env.ASSETS.fetch(request);
      return withHeaders(response, {'cache-control': url.pathname.match(/\.(css|js|webp|png|svg)$/) ? 'public, max-age=3600' : 'no-store'});
    } catch(e) {
      console.error('OPS_ERROR', e?.stack || e);
      const f=friendlyError(e); return json({ok:false,error:f.code,message:f.message},Number(e?.status||500));
    }
  },
  async scheduled(event, env, ctx) {
    ctx.waitUntil(scheduledSnapshot(env).catch(e=>console.error('OPS_SNAPSHOT_FAILED',e)));
  }
};
