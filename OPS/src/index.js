import { SERVICES, MODULES, ROLE_CAPABILITIES, can, userCapabilities, visibleCatalog } from './catalog.js';
import { collectOverview, collectHealth, collectPending, globalSearch, collectSecurity, collectDataQuality, safeAll } from './data.js';
import {
  randomToken, sha256, hashPassword, verifyPassword, parseCookies, sessionCookie, clearSessionCookie,
  json, readJson, ipHash, nowIso, addDaysIso, requireSameOrigin, sanitizeText, normalizeEmail, withHeaders
} from './security.js';

const SESSION_COOKIE = 'ops_session';
const VALID_ROLES = Object.keys(ROLE_CAPABILITIES);

function routeMatch(path, prefix) { return path === prefix || path.startsWith(prefix + '/'); }
function uuid() { return crypto.randomUUID(); }

async function audit(env, request, user, action, targetType = null, targetId = null, metadata = {}) {
  try {
    await env.OPS_DB.prepare(`INSERT INTO ops_audit_logs
      (id, actor_user_id, actor_email, action, target_type, target_id, metadata_json, ip_hash, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .bind(uuid(), user?.id || null, user?.email || null, action, targetType, targetId, JSON.stringify(metadata || {}), await ipHash(request), nowIso()).run();
  } catch {}
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
  const row = await env.OPS_DB.prepare(`SELECT COUNT(*) AS n FROM ops_users`).first();
  return { initialized: Number(row?.n || 0) > 0 };
}

async function bootstrap(request, env) {
  if (!env.SETUP_SECRET) return json({ ok:false, error:'SETUP_DISABLED' }, 403);
  if ((request.headers.get('x-setup-secret') || '') !== env.SETUP_SECRET) return json({ ok:false, error:'SETUP_SECRET_INVALID' }, 403);
  const status = await setupStatus(env);
  if (status.initialized) return json({ ok:false, error:'ALREADY_INITIALIZED' }, 409);
  const body = await readJson(request);
  const email = normalizeEmail(body.email);
  const fullName = sanitizeText(body.full_name, 120);
  const password = String(body.password || '');
  if (!email.includes('@') || fullName.length < 2 || password.length < 12) return json({ ok:false, error:'INVALID_BOOTSTRAP_DATA' }, 400);
  const hp = await hashPassword(password);
  const id = uuid(); const now = nowIso();
  await env.OPS_DB.prepare(`INSERT INTO ops_users
    (id,email,full_name,role,capabilities_json,password_hash,password_salt,password_iterations,status,created_at,updated_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?)`)
    .bind(id,email,fullName,'super_admin','[]',hp.hash,hp.salt,hp.iterations,'active',now,now).run();
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
  const now = new Date();
  const row = await env.OPS_DB.prepare(`SELECT * FROM ops_login_attempts WHERE key=?`).bind(key).first();
  const windowStart = row?.window_started_at ? Date.parse(row.window_started_at) : 0;
  const within = windowStart && (Date.now() - windowStart < 15*60*1000);
  const count = within ? Number(row.count||0)+1 : 1;
  const blocked = count >= 7 ? new Date(Date.now()+15*60*1000).toISOString() : null;
  await env.OPS_DB.prepare(`INSERT INTO ops_login_attempts(key,count,window_started_at,blocked_until) VALUES(?,?,?,?)
    ON CONFLICT(key) DO UPDATE SET count=excluded.count, window_started_at=excluded.window_started_at, blocked_until=excluded.blocked_until`)
    .bind(key,count,within?row.window_started_at:now.toISOString(),blocked).run();
}

async function login(request, env) {
  const body = await readJson(request);
  const email = normalizeEmail(body.email);
  const password = String(body.password || '');
  const ip = await ipHash(request);
  const key = await sha256(`${email}|${ip}`);
  const rate = await checkLoginRate(env, key);
  if (!rate.allowed) return json({ ok:false, error:'LOGIN_RATE_LIMIT', retry_after:rate.retry_after }, 429);
  const user = await env.OPS_DB.prepare(`SELECT * FROM ops_users WHERE email=? COLLATE NOCASE LIMIT 1`).bind(email).first();
  if (!user || user.status !== 'active' || !(await verifyPassword(password, user))) {
    await recordLoginFailure(env,key);
    await audit(env,request,{email},'auth.login_failed','user',user?.id||null,{});
    return json({ ok:false, error:'LOGIN_INVALID' }, 401);
  }
  try { await env.OPS_DB.prepare(`DELETE FROM ops_login_attempts WHERE key=?`).bind(key).run(); } catch {}
  const token = randomToken(32), tokenHash = await sha256(token), csrf = randomToken(24);
  const days = Math.min(30,Math.max(1,Number(env.SESSION_DAYS||14)));
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
  const code = String(e?.message || 'INTERNAL_ERROR');
  const known = {
    AUTH_REQUIRED:'Bạn cần đăng nhập.', FORBIDDEN:'Bạn không có quyền thực hiện thao tác này.',
    CSRF_INVALID:'Phiên bảo mật không hợp lệ. Vui lòng tải lại trang.', BAD_ORIGIN:'Yêu cầu không hợp lệ.',
    INVALID_JSON:'Dữ liệu gửi lên không hợp lệ.', PAYLOAD_TOO_LARGE:'Dữ liệu gửi lên quá lớn.'
  };
  return { code, message:known[code] || 'Không thể hoàn tất yêu cầu lúc này.' };
}

async function incidentsApi(request, env, user, url) {
  if (request.method === 'GET') {
    requireCap(user,'incidents.view');
    const r = await safeAll(env.OPS_DB,`SELECT * FROM ops_incidents ORDER BY CASE status WHEN 'open' THEN 0 WHEN 'investigating' THEN 1 ELSE 2 END, created_at DESC LIMIT 200`);
    return json({ok:true,items:r.data});
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
    await env.OPS_DB.prepare(`UPDATE ops_incidents SET status=?, resolved_at=CASE WHEN ?='resolved' THEN ? ELSE resolved_at END, updated_at=? WHERE id=?`)
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
    return json({ok:true,items:r.data});
  }
  requireCap(user,'alerts.manage'); requireCsrf(request,user);
  if (request.method==='PATCH') {
    const b=await readJson(request), id=sanitizeText(b.id,80);
    await env.OPS_DB.prepare(`UPDATE ops_alerts SET status='acknowledged', acknowledged_by=?, acknowledged_at=?, updated_at=? WHERE id=?`).bind(user.id,nowIso(),nowIso(),id).run();
    await audit(env,request,user,'alert.acknowledge','alert',id,{});
    return json({ok:true});
  }
  return json({ok:false,error:'METHOD_NOT_ALLOWED'},405);
}

async function usersApi(request, env, user) {
  requireCap(user,'ops.users.manage');
  if (request.method==='GET') {
    const r=await safeAll(env.OPS_DB,`SELECT id,email,full_name,role,capabilities_json,status,must_change_password,created_at,updated_at,last_login_at FROM ops_users ORDER BY created_at DESC`);
    return json({ok:true,items:r.data});
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
    const caps=Array.isArray(b.capabilities)?JSON.stringify(b.capabilities):null;
    await env.OPS_DB.prepare(`UPDATE ops_users SET role=COALESCE(?,role), status=COALESCE(?,status), capabilities_json=COALESCE(?,capabilities_json), updated_at=? WHERE id=?`)
      .bind(role,status,caps,nowIso(),id).run();
    if(status==='disabled') await env.OPS_DB.prepare(`DELETE FROM ops_sessions WHERE user_id=?`).bind(id).run();
    await audit(env,request,user,'ops_user.update','user',id,{role,status});
    return json({ok:true});
  }
  return json({ok:false,error:'METHOD_NOT_ALLOWED'},405);
}

async function reportSnapshot(request, env, user) {
  requireCap(user,'reports.manage'); requireCsrf(request,user);
  const payload = { overview:await collectOverview(env,user), health:await collectHealth(user), pending:await collectPending(env,user), generated_at:nowIso(), generated_by:user.email };
  const id=uuid(), now=nowIso(), key=`reports/${now.slice(0,10)}/${id}.json`;
  await env.OPS_DB.prepare(`INSERT INTO ops_kpi_snapshots(id,captured_at,payload_json,created_at) VALUES(?,?,?,?)`).bind(id,now,JSON.stringify(payload),now).run();
  if (env.OPS_R2) await env.OPS_R2.put(key,JSON.stringify(payload,null,2),{httpMetadata:{contentType:'application/json'}});
  await audit(env,request,user,'report.snapshot','report',id,{key});
  return json({ok:true,id,key,captured_at:now},201);
}

async function scheduledSnapshot(env) {
  const fakeUser={role:'super_admin',capabilities_json:'[]'};
  const health=await collectHealth(fakeUser);
  const payload={overview:await collectOverview(env,fakeUser),health,data_quality:await collectDataQuality(env,fakeUser),generated_at:nowIso(),automated:true};
  const id=uuid(), now=nowIso(), key=`snapshots/${now.slice(0,10)}/${id}.json`;
  await env.OPS_DB.prepare(`INSERT INTO ops_kpi_snapshots(id,captured_at,payload_json,created_at) VALUES(?,?,?,?)`).bind(id,now,JSON.stringify(payload),now).run();
  if(env.OPS_R2) await env.OPS_R2.put(key,JSON.stringify(payload,null,2),{httpMetadata:{contentType:'application/json'}});
  for (const item of health.services || []) {
    if (item.probe?.ok) {
      try { await env.OPS_DB.prepare(`UPDATE ops_alerts SET status='resolved', updated_at=? WHERE source='health' AND alert_key=? AND status!='resolved'`).bind(now,`service:${item.service.id}`).run(); } catch {}
    } else {
      try { await env.OPS_DB.prepare(`INSERT INTO ops_alerts(id,source,alert_key,severity,title,detail,status,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?) ON CONFLICT(source,alert_key) DO UPDATE SET severity=excluded.severity,title=excluded.title,detail=excluded.detail,status='open',updated_at=excluded.updated_at`).bind(uuid(),'health',`service:${item.service.id}`,'high',`${item.service.name} không phản hồi bình thường`,JSON.stringify(item.probe||{}),'open',now,now).run(); } catch {}
    }
  }
}

async function api(request, env) {
  const url=new URL(request.url), path=url.pathname;
  if (path==='/api/health' && request.method==='GET') return json({ok:true,service:'sky-first-ops',time:nowIso(),version:'1.0.0'});
  if (path==='/api/setup/status' && request.method==='GET') return json({ok:true,...await setupStatus(env)});
  if (path==='/api/setup/bootstrap' && request.method==='POST') return bootstrap(request,env);
  if (path==='/api/auth/login' && request.method==='POST') return login(request,env);

  const user=await getUser(request,env);
  if (path==='/api/auth/me' && request.method==='GET') return user?json({ok:true,user:publicUser(user)}):json({ok:false,error:'AUTH_REQUIRED'},401);
  if (path==='/api/auth/logout' && request.method==='POST') { if(user) requireCsrf(request,user); return logout(request,env,user); }
  if (!user) return json({ok:false,error:'AUTH_REQUIRED'},401);

  if (path==='/api/overview' && request.method==='GET') { requireCap(user,'overview.view'); return json({ok:true,data:await collectOverview(env,user)}); }
  if (path==='/api/catalog' && request.method==='GET') return json({ok:true,services:SERVICES.filter(s=>visibleCatalog(user).some(x=>x.system===s.id)),modules:visibleCatalog(user)});
  if (path==='/api/services/health' && request.method==='GET') { requireCap(user,'health.view'); return json({ok:true,data:await collectHealth(user)}); }
  if (path==='/api/pending' && request.method==='GET') { requireCap(user,'overview.view'); return json({ok:true,items:await collectPending(env,user)}); }
  if (path==='/api/search' && request.method==='GET') { requireCap(user,'search.global'); return json({ok:true,items:await globalSearch(env,user,url.searchParams.get('q')||'')}); }
  if (path==='/api/security' && request.method==='GET') { if(!(can(user,'security.view')||can(user,'security.*'))) throw Object.assign(new Error('FORBIDDEN'),{status:403}); return json({ok:true,data:await collectSecurity(env,user)}); }
  if (path==='/api/data-quality' && request.method==='GET') { if(!(can(user,'dataquality.view')||can(user,'*.view'))) throw Object.assign(new Error('FORBIDDEN'),{status:403}); return json({ok:true,data:await collectDataQuality(env,user)}); }
  if (path==='/api/incidents') return incidentsApi(request,env,user,url);
  if (path==='/api/alerts') return alertsApi(request,env,user);
  if (path==='/api/admin/users') return usersApi(request,env,user);
  if (path==='/api/audit' && request.method==='GET') {
    if(!(can(user,'audit.view')||can(user,'audit.*'))) throw Object.assign(new Error('FORBIDDEN'),{status:403});
    const r=await safeAll(env.OPS_DB,`SELECT id,actor_email,action,target_type,target_id,metadata_json,created_at FROM ops_audit_logs ORDER BY created_at DESC LIMIT 300`);
    return json({ok:true,items:r.data});
  }
  if (path==='/api/reports/snapshot' && request.method==='POST') return reportSnapshot(request,env,user);
  if (path==='/api/reports/snapshots' && request.method==='GET') {
    requireCap(user,'reports.view'); const r=await safeAll(env.OPS_DB,`SELECT id,captured_at,created_at FROM ops_kpi_snapshots ORDER BY captured_at DESC LIMIT 120`); return json({ok:true,items:r.data});
  }
  if (path==='/api/system/integrations' && request.method==='GET') {
    requireCap(user,'ops.integrations.view');
    return json({ok:true,items:SERVICES.map(s=>({id:s.id,name:s.name,url:s.url,health:s.health,database:s.id==='exam'? 'Dữ liệu kỳ thi thuộc SLC' : 'D1 binding riêng',mode:'read-only aggregation'}))});
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
