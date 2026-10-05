import fs from 'node:fs';
import path from 'node:path';
import { MODULES, SERVICES, can, visibleCatalog } from '../src/catalog.js';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const read = p => fs.readFileSync(path.join(root,p),'utf8');
const checks=[];
function check(name, cond){checks.push([name,Boolean(cond)]); if(!cond) console.error('FAIL',name);}

const cfg=JSON.parse(read('wrangler.jsonc'));
const bindings=(cfg.d1_databases||[]).map(x=>x.binding);
check('10 services registered', SERVICES.length===10);
check('Xanh registered', SERVICES.some(x=>x.id==='xanh'));
check('Research registered', SERVICES.some(x=>x.id==='research'));
check('full capability catalog >= 120 modules', MODULES.length>=120);
check('Pages output directory configured', cfg.pages_build_output_dir==='./public');
check('Pages config has no Worker main', !('main' in cfg));
check('Pages API function exists', fs.existsSync(path.join(root,'functions/api/[[path]].js')));
check('OPS DB configured', bindings.includes('OPS_DB'));
for(const b of ['SLC_DB','MEMBER_DB','TNV_DB','CTT_DB','WEB_DB','SFEC_DB','MAIL_DB']) check(`source D1 ${b} configured`,bindings.includes(b));
check('OPS R2 configured', (cfg.r2_buckets||[]).some(x=>x.binding==='OPS_R2'&&x.bucket_name==='ops'));
check('OPS D1 id correct', (cfg.d1_databases||[]).some(x=>x.binding==='OPS_DB'&&x.database_id==='07072e1e-e1d2-4d91-a262-a91a0e2fadd9'));

const data=read('src/data.js');
check('source data layer has no INSERT', !/\bINSERT\s+INTO\b/i.test(data));
check('source data layer has no UPDATE', !/\bUPDATE\s+[A-Za-z_]/i.test(data));
check('source data layer has no DELETE', !/\bDELETE\s+FROM\b/i.test(data));
check('source data layer has no DROP/ALTER', !/\b(DROP|ALTER)\s+(TABLE|DATABASE)\b/i.test(data));

const sec=read('src/security.js');
check('PBKDF2 password hashing', /PBKDF2/.test(sec)&&/100000/.test(read('migrations/0001_ops_core.sql')));
check('strict session cookie', /HttpOnly; Secure; SameSite=Strict/.test(sec));
check('CSP present', /content-security-policy/.test(sec));
const idx=read('src/index.js');
check('CSRF validation present', /requireCsrf/.test(idx)&&/x-csrf-token/.test(idx));
check('login rate limiting present', /ops_login_attempts/.test(idx));
check('audit log writes only OPS DB', /ops_audit_logs/.test(idx));
check('setup secret protected', /SETUP_SECRET/.test(idx));
check('health API present', /\/api\/health/.test(idx));
check('readiness API present', /\/api\/system\/readiness/.test(idx));
check('first-run schema ensure present', /ensureOpsSchema/.test(idx));
check('catalog API present', /\/api\/catalog/.test(idx));
check('global search API present', /\/api\/search/.test(idx));
check('report snapshot uses R2', /OPS_R2\.put/.test(idx));

const mig=read('migrations/0001_ops_core.sql');
for(const table of ['ops_users','ops_sessions','ops_audit_logs','ops_incidents','ops_alerts','ops_kpi_snapshots','ops_identity_links','ops_automation_rules','ops_settings']) check(`migration contains ${table}`,mig.includes(`CREATE TABLE IF NOT EXISTS ${table}`));

const superUser={role:'super_admin',capabilities_json:'[]'};
const executive={role:'executive',capabilities_json:'[]'};
const education={role:'education_admin',capabilities_json:'[]'};
check('super admin sees every capability',visibleCatalog(superUser).length===MODULES.length);
check('executive sees SLC but cannot manage',can(executive,'slc.classes.view')&&!can(executive,'slc.classes.manage'));
check('education admin can manage SLC',can(education,'slc.classes.manage'));
check('education admin cannot see Member HR by default',!can(education,'member.profile.view'));

const publicJs=read('public/app.js');
check('frontend has no inline secrets',!/SETUP_SECRET\s*=|database_id\s*=|password_hash/.test(publicJs));
check('frontend role-aware navigation',/navAllowed/.test(publicJs)&&/capabilities/.test(publicJs));
check('frontend capability catalog',/catalogGrid/.test(publicJs));
check('frontend search',/globalQ/.test(publicJs));
check('frontend incidents',/newIncident/.test(publicJs));

const failed=checks.filter(x=>!x[1]);
console.log(`OPS validation: ${checks.length-failed.length}/${checks.length} PASS`);
if(failed.length){console.error('Failed:',failed.map(x=>x[0]).join(', '));process.exit(1);}
