import { SERVICES, MODULES, can } from './catalog.js';

function binding(env, name) {
  return env?.[name] || null;
}

export async function safeFirst(db, sql, params = []) {
  if (!db) return { ok: false, data: null, error: 'BINDING_MISSING' };
  try {
    const data = await db.prepare(sql).bind(...params).first();
    return { ok: true, data: data || null, error: null };
  } catch (e) {
    return { ok: false, data: null, error: String(e?.message || e).slice(0, 240) };
  }
}

export async function safeAll(db, sql, params = []) {
  if (!db) return { ok: false, data: [], error: 'BINDING_MISSING' };
  try {
    const r = await db.prepare(sql).bind(...params).all();
    return { ok: true, data: r?.results || [], error: null };
  } catch (e) {
    return { ok: false, data: [], error: String(e?.message || e).slice(0, 240) };
  }
}

async function count(db, table, where = '', params = []) {
  const r = await safeFirst(db, `SELECT COUNT(*) AS n FROM ${table}${where ? ` WHERE ${where}` : ''}`, params);
  return r.ok ? Number(r.data?.n || 0) : null;
}

function hasSystem(user, system) {
  return MODULES.some(x => x.system === system && can(user, x.view_cap));
}

export async function collectOverview(env, user) {
  const jobs = [];
  const out = { generated_at: new Date().toISOString(), systems: {}, totals: {} };

  if (hasSystem(user, 'slc')) jobs.push((async () => {
    const db = binding(env, 'SLC_DB');
    out.systems.slc = {
      users: await count(db, 'users'),
      classes: await count(db, 'classes'),
      class_members: await count(db, 'class_members'),
      assignments: await count(db, 'assignments'),
      submissions: await count(db, 'submissions'),
      exams: await count(db, 'exams'),
      exam_attempts: await count(db, 'exam_attempts'),
      guest_attempts: await count(db, 'exam_guest_attempts'),
      open_tickets: await count(db, 'support_tickets', `status NOT IN ('closed','resolved')`),
      active_incidents: await count(db, 'system_incidents', 'resolved_at IS NULL')
    };
  })());

  if (hasSystem(user, 'member')) jobs.push((async () => {
    const db = binding(env, 'MEMBER_DB');
    out.systems.member = {
      accounts: await count(db, 'accounts'),
      people: await count(db, 'people'),
      account_requests: await count(db, 'account_requests'),
      pending_requests: await count(db, 'account_requests', `status IN ('pending','new','submitted')`),
      tasks: await count(db, 'tasks'),
      support_tickets: await count(db, 'support_tickets'),
      security_events: await count(db, 'security_events'),
      sessions: await count(db, 'sessions')
    };
  })());

  if (hasSystem(user, 'tnv')) jobs.push((async () => {
    const db = binding(env, 'TNV_DB');
    out.systems.tnv = {
      users: await count(db, 'users'),
      applications: await count(db, 'volunteer_applications'),
      pending_applications: await count(db, 'volunteer_applications', `status IN ('pending','new','submitted')`),
      opportunities: await count(db, 'opportunities'),
      tasks: await count(db, 'tasks'),
      certificates: await count(db, 'certificates'),
      support_tickets: await count(db, 'support_tickets')
    };
  })());

  if (hasSystem(user, 'ctt')) jobs.push((async () => {
    const db = binding(env, 'CTT_DB');
    out.systems.ctt = {
      users: await count(db, 'users'),
      people: await count(db, 'people'),
      submissions: await count(db, 'submissions'),
      pending_submissions: await count(db, 'submissions', `status IN ('pending','new','submitted')`),
      approvals: await count(db, 'approvals'),
      pending_approvals: await count(db, 'approvals', `status IN ('pending','waiting')`),
      tasks: await count(db, 'tasks'),
      tickets: await count(db, 'tickets'),
      certificates: await count(db, 'certificates'),
      events: await count(db, 'events')
    };
  })());

  if (hasSystem(user, 'web')) jobs.push((async () => {
    const db = binding(env, 'WEB_DB');
    out.systems.web = {
      admins: await count(db, 'website_admin_users'),
      registrations: await count(db, 'website_registrations'),
      contacts: await count(db, 'website_contacts'),
      comments: await count(db, 'website_comments'),
      audit_events: await count(db, 'website_admin_audit')
    };
  })());

  if (hasSystem(user, 'sfec')) jobs.push((async () => {
    const db = binding(env, 'SFEC_DB');
    out.systems.sfec = {
      users: await count(db, 'users'),
      people: await count(db, 'people'),
      submissions: await count(db, 'submissions'),
      pending_submissions: await count(db, 'submissions', `status IN ('pending','new','submitted')`),
      approvals: await count(db, 'approvals'),
      pending_approvals: await count(db, 'approvals', `status IN ('pending','waiting')`),
      tasks: await count(db, 'tasks'),
      tickets: await count(db, 'tickets'),
      certificates: await count(db, 'certificates'),
      events: await count(db, 'events'),
      attendance_records: await count(db, 'attendance')
    };
  })());

  if (hasSystem(user, 'mail')) jobs.push((async () => {
    const db = binding(env, 'MAIL_DB');
    out.systems.mail = {
      users: await count(db, 'users'),
      messages: await count(db, 'messages'),
      mailboxes: await count(db, 'mailboxes'),
      delivery_events: await count(db, 'delivery_events'),
      notifications: await count(db, 'notifications'),
      sessions: await count(db, 'sessions'),
      audit_events: await count(db, 'audit_logs'),
      logins: await count(db, 'login_history')
    };
  })());

  await Promise.all(jobs);

  const raw = (sys,key) => out.systems?.[sys]?.[key];
  const sumKnown = pairs => { const values=pairs.filter(([a])=>a in out.systems).map(([a,b])=>raw(a,b)); if(!values.length)return null; return values.some(v=>v===null||v===undefined) ? null : values.reduce((n,v)=>n+Number(v||0),0); };
  out.totals = {
    people_and_accounts: sumKnown([['slc','users'],['member','people'],['tnv','users'],['ctt','people'],['sfec','people']]),
    classes: raw('slc','classes') ?? null,
    exams: raw('slc','exams') ?? null,
    exam_attempts: sumKnown([['slc','exam_attempts'],['slc','guest_attempts']]),
    pending_work: sumKnown([['member','pending_requests'],['tnv','pending_applications'],['ctt','pending_submissions'],['ctt','pending_approvals'],['sfec','pending_submissions'],['sfec','pending_approvals']]),
    messages: raw('mail','messages') ?? null
  };
  return out;
}

async function probe(url, timeoutMs = 4500) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort('timeout'), timeoutMs);
  const started = Date.now();
  try {
    const r = await fetch(url, { method: 'GET', redirect: 'follow', signal: controller.signal, headers: { 'accept': 'application/json,text/plain,text/html;q=0.8' } });
    let detail = null;
    const ct = r.headers.get('content-type') || '';
    if (ct.includes('application/json')) {
      try { detail = await r.json(); } catch {}
    }
    const expectedJson=new URL(url).pathname!=='/';
    const validBody=!expectedJson || (detail && typeof detail==='object' && detail.ok!==false && detail.status!=='error');
    return { ok: r.ok && Boolean(validBody), status: r.status, latency_ms: Date.now() - started, detail };
  } catch (e) {
    return { ok: false, status: 0, latency_ms: Date.now() - started, error: e?.name === 'AbortError' ? 'TIMEOUT' : String(e?.message || e).slice(0, 160) };
  } finally { clearTimeout(timer); }
}

export async function collectHealth(user) {
  const allowed = SERVICES.filter(s => hasSystem(user, s.id) || can(user, 'health.view') || can(user, 'health.*'));
  const results = await Promise.all(allowed.map(async service => ({ service, probe: await probe(service.health) })));
  return { generated_at: new Date().toISOString(), services: results };
}

export async function collectPending(env, user) {
  const items = [];
  const unavailable = [];
  const pushRows = (system, type, rows, titleField, statusField = 'status') => {
    for (const row of rows || []) items.push({ system, type, id: row.id, title: row[titleField] || row.id, status: row[statusField] || 'pending', due_at: row.due_at || null, created_at: row.created_at || null });
  };

  const jobs = [];
  if (can(user, 'member.accountrequests.view')) jobs.push((async()=>{
    const r = await safeAll(env.MEMBER_DB, `SELECT id, full_name, status, created_at FROM account_requests WHERE status IN ('pending','new','submitted') ORDER BY created_at DESC LIMIT 25`);
    if(!r.ok) unavailable.push('Nguồn dữ liệu chưa sẵn sàng');
    pushRows('member','account_request',r.data,'full_name');
  })());
  if (can(user, 'tnv.applications.view')) jobs.push((async()=>{
    const r = await safeAll(env.TNV_DB, `SELECT id, full_name, status, created_at FROM volunteer_applications WHERE status IN ('pending','new','submitted') ORDER BY created_at DESC LIMIT 25`);
    if(!r.ok) unavailable.push('Nguồn dữ liệu chưa sẵn sàng');
    pushRows('tnv','volunteer_application',r.data,'full_name');
  })());
  if (can(user, 'ctt.approvals.view')) jobs.push((async()=>{
    const r = await safeAll(env.CTT_DB, `SELECT id, entity_type AS title, status, due_at, created_at FROM approvals WHERE status IN ('pending','waiting') ORDER BY created_at DESC LIMIT 25`);
    if(!r.ok) unavailable.push('Nguồn dữ liệu chưa sẵn sàng');
    pushRows('ctt','approval',r.data,'title');
  })());
  if (can(user, 'ctt.recruitment.view')) jobs.push((async()=>{
    const r = await safeAll(env.CTT_DB, `SELECT id, full_name, status, created_at FROM submissions WHERE status IN ('pending','new','submitted') ORDER BY created_at DESC LIMIT 25`);
    if(!r.ok) unavailable.push('Nguồn dữ liệu chưa sẵn sàng');
    pushRows('ctt','submission',r.data,'full_name');
  })());
  if (can(user, 'sfec.approvals.view')) jobs.push((async()=>{
    const r = await safeAll(env.SFEC_DB, `SELECT id, entity_type AS title, status, due_at, created_at FROM approvals WHERE status IN ('pending','waiting') ORDER BY created_at DESC LIMIT 25`);
    if(!r.ok) unavailable.push('Nguồn dữ liệu chưa sẵn sàng');
    pushRows('sfec','approval',r.data,'title');
  })());
  if (can(user, 'sfec.recruitment.view')) jobs.push((async()=>{
    const r = await safeAll(env.SFEC_DB, `SELECT id, full_name, status, created_at FROM submissions WHERE status IN ('pending','new','submitted') ORDER BY created_at DESC LIMIT 25`);
    if(!r.ok) unavailable.push('Nguồn dữ liệu chưa sẵn sàng');
    pushRows('sfec','submission',r.data,'full_name');
  })());
  if (can(user, 'slc.support.view')) jobs.push((async()=>{
    const r = await safeAll(env.SLC_DB, `SELECT id, subject, status, created_at FROM support_tickets WHERE status NOT IN ('closed','resolved') ORDER BY created_at DESC LIMIT 25`);
    if(!r.ok) unavailable.push('Nguồn dữ liệu chưa sẵn sàng');
    pushRows('slc','support_ticket',r.data,'subject');
  })());
  await Promise.all(jobs);
  items.sort((a,b)=>String(b.created_at||'').localeCompare(String(a.created_at||'')));
  return {items:items.slice(0,100),partial:unavailable.length>0,unavailable_sources:unavailable.length};
}

function maskEmail(email) {
  const [a,b] = String(email || '').split('@');
  if (!b) return '';
  return `${a.slice(0,2)}***@${b}`;
}

export async function globalSearch(env, user, query) {
  const q = String(query || '').trim().toLowerCase();
  if (q.length < 2) return [];
  const cleaned=q.replace(/[%_]/g,'').slice(0,120); if(cleaned.length<2)return [];
  const like = `%${cleaned}%`;
  const results = [];
  const add = (system, type, rows, label, emailKey = 'email') => {
    for (const row of rows || []) results.push({ system, type, id: row.id, label: label==='email'?maskEmail(row[label]):(row[label] || row.id), secondary: row[emailKey] ? (emailKey==='code'?row[emailKey]:maskEmail(row[emailKey])) : (row.status || '') });
  };
  const jobs = [];
  if (can(user, 'slc.users.view')) jobs.push((async()=>{ const r=await safeAll(env.SLC_DB, `SELECT id, full_name, email, status FROM users WHERE lower(full_name) LIKE ? OR lower(email) LIKE ? LIMIT 12`,[like,like]); add('slc','user',r.data,'full_name'); })());
  if (can(user, 'slc.classes.view')) jobs.push((async()=>{ const r=await safeAll(env.SLC_DB, `SELECT id, name, status FROM classes WHERE lower(name) LIKE ? LIMIT 12`,[like]); add('slc','class',r.data,'name',''); })());
  if (can(user, 'member.directory.view')) jobs.push((async()=>{ const r=await safeAll(env.MEMBER_DB, `SELECT id, email, status FROM people WHERE lower(email) LIKE ? LIMIT 12`,[like]); add('member','person',r.data,'email'); })());
  if (can(user, 'tnv.applications.view')) jobs.push((async()=>{ const r=await safeAll(env.TNV_DB, `SELECT id, full_name, email, status FROM volunteer_applications WHERE lower(full_name) LIKE ? OR lower(email) LIKE ? LIMIT 12`,[like,like]); add('tnv','application',r.data,'full_name'); })());
  if (can(user, 'ctt.hr.view')) jobs.push((async()=>{ const r=await safeAll(env.CTT_DB, `SELECT id, full_name, email, status FROM people WHERE lower(full_name) LIKE ? OR lower(email) LIKE ? LIMIT 12`,[like,like]); add('ctt','person',r.data,'full_name'); })());
  if (can(user, 'ctt.certificates.view')) jobs.push((async()=>{ const r=await safeAll(env.CTT_DB, `SELECT id, code, full_name, status FROM certificates WHERE lower(code) LIKE ? OR lower(full_name) LIKE ? LIMIT 12`,[like,like]); add('ctt','certificate',r.data,'full_name','code'); })());
  if (can(user, 'sfec.people.view')) jobs.push((async()=>{ const r=await safeAll(env.SFEC_DB, `SELECT id, full_name, email, status FROM people WHERE lower(full_name) LIKE ? OR lower(email) LIKE ? LIMIT 12`,[like,like]); add('sfec','person',r.data,'full_name'); })());
  if (can(user, 'web.registrations.view')) jobs.push((async()=>{ const r=await safeAll(env.WEB_DB, `SELECT id, full_name, email, status FROM website_registrations WHERE lower(full_name) LIKE ? OR lower(email) LIKE ? LIMIT 12`,[like,like]); add('web','registration',r.data,'full_name'); })());
  if (can(user, 'mail.mailbox.view')) jobs.push((async()=>{ const r=await safeAll(env.MAIL_DB, `SELECT id, address AS label, display_name FROM mailboxes WHERE lower(address) LIKE ? OR lower(display_name) LIKE ? LIMIT 12`,[like,like]); for(const row of r.data) results.push({system:'mail',type:'mailbox',id:row.id,label:row.display_name||row.label,secondary:maskEmail(row.label)}); })());
  await Promise.all(jobs);
  return results.slice(0, 80);
}

export async function collectSecurity(env, user) {
  const data = {};
  const jobs = [];
  if (can(user,'member.security.view') || can(user,'security.view') || can(user,'security.*')) jobs.push((async()=>{
    data.member = {
      events_7d: await count(env.MEMBER_DB,'security_events',`created_at >= datetime('now','-7 days')`),
      active_sessions: await count(env.MEMBER_DB,'sessions',`last_seen_at >= datetime('now','-30 days')`)
    };
  })());
  if (can(user,'mail.audit.view') || can(user,'security.view') || can(user,'security.*')) jobs.push((async()=>{
    data.mail = {
      logins_7d: await count(env.MAIL_DB,'login_history',`created_at >= datetime('now','-7 days')`),
      active_sessions: await count(env.MAIL_DB,'sessions',`expires_at > datetime('now')`)
    };
  })());
  if (can(user,'slc.audit.view') || can(user,'security.view') || can(user,'security.*')) jobs.push((async()=>{
    data.slc = {
      audit_7d: await count(env.SLC_DB,'audit_logs',`created_at >= datetime('now','-7 days')`),
      incidents_open: await count(env.SLC_DB,'system_incidents','resolved_at IS NULL')
    };
  })());
  if (can(user,'ctt.audit.view') || can(user,'security.view') || can(user,'security.*')) jobs.push((async()=>{
    data.ctt = { audit_7d: await count(env.CTT_DB,'audit_log',`created_at >= datetime('now','-7 days')`) };
  })());
  if (can(user,'sfec.audit.view') || can(user,'security.view') || can(user,'security.*')) jobs.push((async()=>{
    data.sfec = { audit_7d: await count(env.SFEC_DB,'audit_log',`created_at >= datetime('now','-7 days')`) };
  })());
  await Promise.all(jobs);
  return { generated_at:new Date().toISOString(), systems:data };
}

export async function collectDataQuality(env, user) {
  const issues = [];
  let skipped=0,checked=0;
  const add = (system, code, countValue, severity, title) => {
    if (countValue === null) {skipped++;return;} checked++;
    if (Number(countValue) <= 0) return;
    issues.push({ system, code, count:Number(countValue), severity, title });
  };
  const jobs=[];
  if (can(user,'slc.classes.view')) jobs.push((async()=>{
    add('slc','classes_without_owner',await count(env.SLC_DB,'classes',`owner_user_id IS NULL OR trim(owner_user_id)=''`),'high','Lớp chưa có chủ sở hữu');
    const r=await safeFirst(env.SLC_DB,`SELECT COUNT(*) AS n FROM classes c LEFT JOIN class_members m ON m.class_id=c.id WHERE m.class_id IS NULL`); add('slc','classes_without_members',r.ok?Number(r.data?.n||0):null,'medium','Lớp chưa có thành viên');
  })());
  if (can(user,'slc.assessment.view')) jobs.push((async()=>{
    add('slc','exams_without_questions',await count(env.SLC_DB,'exams',`question_json IS NULL OR trim(question_json)='' OR trim(question_json)='[]'`),'critical','Kỳ thi chưa có câu hỏi');
  })());
  if (can(user,'member.directory.view')) jobs.push((async()=>{add('member','people_missing_email',await count(env.MEMBER_DB,'people',`email IS NULL OR trim(email)=''`),'high','Hồ sơ thành viên thiếu email');})());
  if (can(user,'tnv.users.view')) jobs.push((async()=>{add('tnv','users_missing_email',await count(env.TNV_DB,'users',`email IS NULL OR trim(email)=''`),'high','Tài khoản TNV thiếu email');})());
  if (can(user,'ctt.hr.view')) jobs.push((async()=>{add('ctt','people_missing_email',await count(env.CTT_DB,'people',`email IS NULL OR trim(email)=''`),'high','Hồ sơ CTT thiếu email');})());
  if (can(user,'sfec.people.view')) jobs.push((async()=>{add('sfec','people_missing_email',await count(env.SFEC_DB,'people',`email IS NULL OR trim(email)=''`),'high','Hồ sơ SFEC thiếu email');})());
  if (can(user,'web.registrations.view')) jobs.push((async()=>{add('web','registrations_missing_email',await count(env.WEB_DB,'website_registrations',`email IS NULL OR trim(email)=''`),'medium','Đăng ký website thiếu email');})());
  if (can(user,'mail.adminusers.view')) jobs.push((async()=>{
    const r=await safeFirst(env.MAIL_DB,`SELECT COUNT(*) AS n FROM users u LEFT JOIN mailboxes m ON m.user_id=u.id WHERE m.id IS NULL`); add('mail','users_without_mailbox',r.ok?Number(r.data?.n||0):null,'high','Người dùng Mail chưa có mailbox');
  })());
  await Promise.all(jobs);
  issues.sort((a,b)=>({critical:0,high:1,medium:2,low:3}[a.severity]-({critical:0,high:1,medium:2,low:3}[b.severity])));
  return { generated_at:new Date().toISOString(), issues,checked,skipped,partial:skipped>0 };
}
