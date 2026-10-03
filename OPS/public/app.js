const $ = (s, root=document) => root.querySelector(s);
const $$ = (s, root=document) => [...root.querySelectorAll(s)];
const app = $('#app');
const state = { user:null, csrf:null, catalog:[], services:[], overview:null, health:null, pending:[] };

function esc(v){return String(v??'').replace(/[&<>"']/g,c=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));}
function fmt(n){if(n===null||n===undefined)return '—'; return Number(n).toLocaleString('vi-VN');}
function capMatch(pattern,value){if(pattern==='*')return true; const re='^'+pattern.replace(/[.+?^${}()|[\]\\]/g,'\\$&').replace(/\*/g,'.*')+'$'; return new RegExp(re).test(value);}
function can(cap){return (state.user?.capabilities||[]).some(p=>capMatch(p,cap));}
function toast(msg){let t=$('.toast');if(t)t.remove();t=document.createElement('div');t.className='toast';t.textContent=msg;document.body.append(t);setTimeout(()=>t.remove(),3500);}

async function api(path,opts={}){
  const method=(opts.method||'GET').toUpperCase();
  const headers=new Headers(opts.headers||{});
  if(opts.body && !headers.has('content-type')) headers.set('content-type','application/json');
  if(!['GET','HEAD','OPTIONS'].includes(method) && state.csrf) headers.set('x-csrf-token',state.csrf);
  const r=await fetch(path,{...opts,method,headers});
  let data={}; try{data=await r.json();}catch{}
  if(r.status===401 && !path.includes('/auth/login')){state.user=null;state.csrf=null;renderLogin();throw new Error('AUTH_REQUIRED');}
  if(!r.ok) throw Object.assign(new Error(data.message||data.error||'Không thể hoàn tất yêu cầu.'),{data,status:r.status});
  return data;
}

function authShell(title,subtitle,inner){
  app.className=''; app.innerHTML=`<div class="auth-page"><div class="auth-card"><div class="auth-brand"><img src="/logo.webp" alt="Sky First"><div><h1>${esc(title)}</h1><p>${esc(subtitle)}</p></div></div>${inner}</div></div>`;
}

async function init(){
  try{
    const st=await api('/api/setup/status');
    if(!st.initialized){renderSetup();return;}
    const me=await api('/api/auth/me'); state.user=me.user;state.csrf=me.user.csrf_token;renderApp();await loadCore();
  }catch(e){if(e.status===401||e.message==='AUTH_REQUIRED')renderLogin();else{authShell('Trung tâm Điều hành Sky First','Không thể mở Trung tâm Điều hành. Kiểm tra D1/binding hoặc cấu hình Pages rồi thử lại.',`<div class="notice error">${esc(e.message)}</div>`);}}
}

function renderSetup(){
  authShell('Khởi tạo Trung tâm Điều hành','Chỉ thực hiện một lần cho tài khoản quản trị đầu tiên.',`
    <form id="setupForm">
      <div class="field"><label>SETUP SECRET</label><input name="secret" type="password" required autocomplete="off"></div>
      <div class="field"><label>Họ và tên</label><input name="full_name" required maxlength="120"></div>
      <div class="field"><label>Email quản trị</label><input name="email" type="email" required></div>
      <div class="field"><label>Mật khẩu ban đầu</label><input name="password" type="password" required minlength="12" autocomplete="new-password"></div>
      <button class="btn primary full" type="submit">Khởi tạo hệ thống</button><div id="authMsg"></div>
    </form>`);
  $('#setupForm').addEventListener('submit',async e=>{e.preventDefault();const f=new FormData(e.currentTarget),btn=$('button',e.currentTarget);btn.disabled=true;try{await api('/api/setup/bootstrap',{method:'POST',headers:{'x-setup-secret':f.get('secret')},body:JSON.stringify({full_name:f.get('full_name'),email:f.get('email'),password:f.get('password')})});toast('Khởi tạo thành công.');renderLogin();}catch(err){$('#authMsg').innerHTML=`<div class="notice error">${esc(err.message)}</div>`;}finally{btn.disabled=false;}});
}

function renderLogin(){
  authShell('Trung tâm Điều hành Sky First','Đăng nhập để truy cập dữ liệu điều hành theo cấp quyền.',`
    <form id="loginForm"><div class="field"><label>Email</label><input name="email" type="email" required autocomplete="username"></div><div class="field"><label>Mật khẩu</label><input name="password" type="password" required autocomplete="current-password"></div><button class="btn primary full" type="submit">Đăng nhập</button><div id="authMsg"></div></form>`);
  $('#loginForm').addEventListener('submit',async e=>{e.preventDefault();const f=new FormData(e.currentTarget),btn=$('button',e.currentTarget);btn.disabled=true;try{const r=await api('/api/auth/login',{method:'POST',body:JSON.stringify({email:f.get('email'),password:f.get('password')})});state.user=r.user;state.csrf=r.user.csrf_token;renderApp();await loadCore();}catch(err){$('#authMsg').innerHTML=`<div class="notice error">${esc(err.message)}</div>`;}finally{btn.disabled=false;}});
}

const navItems=[
  ['overview','⌂','Tổng quan','overview.view'],['alerts','!','Cảnh báo','alerts.view'],['systems','◉','Hệ thống','health.view'],['catalog','▦','Chức năng',null],['pending','✓','Việc cần xử lý','overview.view'],['search','⌕','Tìm kiếm','search.global'],['security','◆','Bảo mật','security.view'],['dataquality','◇','Chất lượng dữ liệu','dataquality.view'],['incidents','⚠','Sự cố','incidents.view'],['audit','⌁','Audit','audit.view'],['reports','▤','Báo cáo','reports.view'],['users','◎','Quyền Ops','ops.users.manage'],['integrations','⚙','Tích hợp','ops.integrations.view']
];
function navAllowed(cap){if(!cap)return true;if(cap==='security.view')return can('security.view')||can('security.*');if(cap==='audit.view')return can('audit.view')||can('audit.*');return can(cap);}

function renderApp(){
  const initials=(state.user?.full_name||state.user?.email||'SF').split(/\s+/).slice(-2).map(x=>x[0]).join('').toUpperCase();
  app.className='';app.innerHTML=`<div class="shell"><aside class="sidebar"><div class="brand"><img src="/logo.webp" alt="Sky First"><div><b>TRUNG TÂM ĐIỀU HÀNH</b><small>Sky First Operations Center</small></div></div><div class="nav">${navItems.filter(x=>navAllowed(x[3])).map(([id,ico,label])=>`<button data-page="${id}" class="${id==='overview'?'active':''}">${ico} <span>${label}</span></button>`).join('')}</div><div class="sidebar-foot">Ops chỉ tổng hợp và điều phối. Dữ liệu gốc vẫn thuộc từng hệ thống chuyên trách.</div></aside><main class="main"><div class="topbar"><div><h2 id="pageTitle">Tổng quan điều hành</h2><p id="pageSub">Theo dõi toàn bộ hệ sinh thái Sky First trong một màn hình.</p></div><div class="userbox"><div class="avatar">${esc(initials)}</div><div><b>${esc(state.user.full_name)}</b><small>${esc(state.user.role)}</small></div><button id="logout" class="btn ghost">Đăng xuất</button></div></div><section id="page-overview" class="page active"></section><section id="page-alerts" class="page"></section><section id="page-systems" class="page"></section><section id="page-catalog" class="page"></section><section id="page-pending" class="page"></section><section id="page-search" class="page"></section><section id="page-security" class="page"></section><section id="page-dataquality" class="page"></section><section id="page-incidents" class="page"></section><section id="page-audit" class="page"></section><section id="page-reports" class="page"></section><section id="page-users" class="page"></section><section id="page-integrations" class="page"></section></main></div>`;
  $$('.nav button').forEach(b=>b.addEventListener('click',()=>openPage(b.dataset.page)));
  $('#logout').addEventListener('click',async()=>{try{await api('/api/auth/logout',{method:'POST'});}catch{}state.user=null;state.csrf=null;renderLogin();});
}

async function loadCore(){
  const jobs=[api('/api/catalog').then(r=>{state.catalog=r.modules;state.services=r.services;}).catch(()=>{}),api('/api/overview').then(r=>state.overview=r.data).catch(()=>{}),api('/api/pending').then(r=>state.pending=r.items).catch(()=>{})];
  if(can('health.view'))jobs.push(api('/api/services/health').then(r=>state.health=r.data).catch(()=>{}));
  await Promise.all(jobs);renderOverview();renderCatalog();renderPending();renderSystems();
}

function openPage(id){
  $$('.page').forEach(x=>x.classList.remove('active'));$(`#page-${id}`)?.classList.add('active');$$('.nav button').forEach(x=>x.classList.toggle('active',x.dataset.page===id));
  const labels={overview:['Tổng quan điều hành','Số liệu và việc cần xử lý trong toàn hệ sinh thái.'],alerts:['Trung tâm cảnh báo','Cảnh báo vận hành và health được ghi nhận tại Ops.'],systems:['Trạng thái hệ thống','Health check 8 hệ thống Sky First.'],catalog:['Danh mục chức năng','Mọi capability được đăng ký và hiển thị theo cấp quyền.'],pending:['Việc cần xử lý','Tổng hợp các hồ sơ, phê duyệt và ticket đang chờ.'],search:['Tìm kiếm toàn SFN','Tìm trên các nguồn dữ liệu mà tài khoản của bạn được phép xem.'],security:['Security Center','Tổng hợp tín hiệu bảo mật từ các hệ thống.'],dataquality:['Chất lượng dữ liệu','Phát hiện các hồ sơ và dữ liệu cần kiểm tra.'],incidents:['Incident Center','Theo dõi và điều phối sự cố.'],audit:['Audit Center','Lịch sử thao tác trong Trung tâm Điều hành.'],reports:['Báo cáo & Snapshot','Tạo snapshot KPI và lưu vào D1/R2 Ops.'],users:['Quản lý quyền Ops','Tài khoản và cấp quyền truy cập Trung tâm Điều hành.'],integrations:['Tích hợp hệ sinh thái','Nguồn dữ liệu và chế độ kết nối của 8 hệ thống.']};
  $('#pageTitle').textContent=labels[id]?.[0]||'Trung tâm Điều hành';$('#pageSub').textContent=labels[id]?.[1]||'';
  if(id==='search')renderSearch();if(id==='alerts')loadAlerts();if(id==='security')loadSecurity();if(id==='dataquality')loadDataQuality();if(id==='incidents')loadIncidents();if(id==='audit')loadAudit();if(id==='reports')loadReports();if(id==='users')loadUsers();if(id==='integrations')loadIntegrations();
}

function renderOverview(){
  const o=state.overview||{totals:{},systems:{}};const t=o.totals||{};
  const systemRows=Object.entries(o.systems||{}).map(([id,metrics])=>{const service=state.services.find(s=>s.id===id);const total=Object.values(metrics||{}).filter(x=>typeof x==='number').reduce((a,b)=>a+b,0);return `<div class="row"><div class="row-main"><b>${esc(service?.name||id)}</b><small>${Object.entries(metrics||{}).slice(0,4).map(([k,v])=>`${k}: ${fmt(v)}`).join(' · ')}</small></div><span class="badge neutral">${fmt(total)}</span></div>`;}).join('');
  $('#page-overview').innerHTML=`<div class="hero"><div><h3>Điều hành toàn hệ sinh thái từ một nơi</h3><p>Ops đang đọc tổng hợp các nguồn dữ liệu được cấp quyền. Mọi chức năng vẫn giữ dữ liệu gốc tại hệ thống chuyên trách.</p></div><div class="hero-actions">${can('search.global')?'<button class="btn soft" data-open="search">Tìm toàn SFN</button>':''}${can('reports.manage')?'<button class="btn ghost" data-snapshot>Chụp snapshot</button>':''}</div></div><div class="grid4"><div class="stat"><small>Người & tài khoản</small><b>${fmt(t.people_and_accounts)}</b></div><div class="stat"><small>Lớp học</small><b>${fmt(t.classes)}</b></div><div class="stat"><small>Lượt dự thi</small><b>${fmt(t.exam_attempts)}</b></div><div class="stat"><small>Việc đang chờ</small><b>${fmt(t.pending_work)}</b></div></div><div class="section-grid"><div class="card"><div class="card-head"><h3>Dữ liệu theo hệ thống</h3><span class="subtle">${esc(o.generated_at||'')}</span></div><div class="rows">${systemRows||'<div class="empty">Chưa có dữ liệu.</div>'}</div></div><div class="card"><div class="card-head"><h3>Việc cần xử lý</h3><button class="btn soft" data-open="pending">Xem tất cả</button></div><div class="rows">${pendingRows(state.pending.slice(0,8))}</div></div></div>`;
  $$('[data-open]','#page-overview').forEach(b=>b.addEventListener('click',()=>openPage(b.dataset.open)));$('[data-snapshot]','#page-overview')?.addEventListener('click',createSnapshot);
}

function pendingRows(items){return items?.length?items.map(x=>`<div class="row"><div class="row-main"><b>${esc(x.title)}</b><small>${esc(x.system.toUpperCase())} · ${esc(x.type)}${x.created_at?' · '+esc(x.created_at):''}</small></div><span class="badge warn">${esc(x.status)}</span></div>`).join(''):'<div class="empty">Không có việc chờ trong phạm vi quyền hiện tại.</div>';}
function renderPending(){$('#page-pending').innerHTML=`<div class="card"><div class="card-head"><h3>Hàng đợi toàn hệ thống</h3><button class="btn ghost" id="refreshPending">Làm mới</button></div><div class="rows">${pendingRows(state.pending)}</div></div>`;$('#refreshPending')?.addEventListener('click',async()=>{const r=await api('/api/pending');state.pending=r.items;renderPending();renderOverview();});}

function renderSystems(){
  const health=state.health?.services||[];$('#page-systems').innerHTML=`<div class="card"><div class="card-head"><h3>8 hệ thống kết nối</h3><button class="btn ghost" id="refreshHealth">Kiểm tra lại</button></div><div class="rows">${health.length?health.map(x=>`<div class="row"><div class="row-main"><b>${esc(x.service.name)}</b><small>${esc(x.service.url)} · ${fmt(x.probe.latency_ms)} ms</small></div><span class="badge ${x.probe.ok?'ok':'danger'}">${x.probe.ok?'Hoạt động':`Lỗi ${x.probe.status||''}`}</span></div>`).join(''):'<div class="empty">Chưa tải trạng thái dịch vụ.</div>'}</div></div>`;
  $('#refreshHealth')?.addEventListener('click',async()=>{const r=await api('/api/services/health');state.health=r.data;renderSystems();});
}

function renderCatalog(){
  const systems=[...new Set(state.catalog.map(x=>x.system))],cats=[...new Set(state.catalog.map(x=>x.category))];
  $('#page-catalog').innerHTML=`<div class="toolbar"><input id="catalogQ" placeholder="Tìm chức năng…"><select id="catalogSystem"><option value="">Tất cả hệ thống</option>${systems.map(x=>`<option>${esc(x)}</option>`).join('')}</select><select id="catalogCat"><option value="">Tất cả nhóm</option>${cats.map(x=>`<option>${esc(x)}</option>`).join('')}</select></div><div id="catalogGrid" class="catalog"></div>`;
  const draw=()=>{const q=$('#catalogQ').value.toLowerCase(),sys=$('#catalogSystem').value,cat=$('#catalogCat').value;const list=state.catalog.filter(x=>(!q||`${x.name} ${x.description}`.toLowerCase().includes(q))&&(!sys||x.system===sys)&&(!cat||x.category===cat));$('#catalogGrid').innerHTML=list.map(x=>`<article class="module"><div class="system">${esc(x.system)} · ${esc(x.category)}</div><h4>${esc(x.name)}</h4><p>${esc(x.description)}</p><div class="module-actions"><span class="badge ${x.can_manage?'ok':'neutral'}">${x.can_manage?'Có quyền thao tác':'Chỉ xem'}</span><a href="${esc(x.url)}" target="_blank" rel="noopener">Mở hệ thống ↗</a></div></article>`).join('')||'<div class="empty">Không tìm thấy chức năng phù hợp.</div>';};
  ['catalogQ','catalogSystem','catalogCat'].forEach(id=>$(`#${id}`).addEventListener(id==='catalogQ'?'input':'change',draw));draw();
}

function renderSearch(){
  $('#page-search').innerHTML=`<div class="card"><h3>Tìm kiếm toàn SFN</h3><div class="searchbox"><input id="globalQ" placeholder="Họ tên, email, lớp, mã chứng nhận…"><button id="globalGo" class="btn primary">Tìm</button></div><div id="searchResults" class="search-results"><div class="empty">Nhập ít nhất 2 ký tự để tìm.</div></div></div>`;
  const go=async()=>{const q=$('#globalQ').value.trim();if(q.length<2)return;$('#searchResults').innerHTML='<div class="empty">Đang tìm…</div>';try{const r=await api('/api/search?q='+encodeURIComponent(q));$('#searchResults').innerHTML=r.items.length?r.items.map(x=>`<div class="row"><div class="row-main"><b>${esc(x.label)}</b><small>${esc(x.system.toUpperCase())} · ${esc(x.type)} · ${esc(x.secondary||'')}</small></div><span class="badge neutral">${esc(x.id)}</span></div>`).join(''):'<div class="empty">Không có kết quả trong phạm vi quyền của bạn.</div>';}catch(e){toast(e.message);}};
  $('#globalGo').addEventListener('click',go);$('#globalQ').addEventListener('keydown',e=>{if(e.key==='Enter')go();});
}


async function loadAlerts(){
  const root=$('#page-alerts');root.innerHTML='<div class="card"><div class="empty">Đang tải cảnh báo…</div></div>';
  try{const r=await api('/api/alerts');root.innerHTML=`<div class="card"><div class="rows">${r.items.length?r.items.map(x=>`<div class="row"><div class="row-main"><b>${esc(x.title)}</b><small>${esc(x.source)} · ${esc(x.created_at)}${x.detail?' · '+esc(x.detail).slice(0,120):''}</small></div><span class="badge ${x.severity==='critical'||x.severity==='high'?'danger':x.severity==='medium'?'warn':'neutral'}">${esc(x.status)} · ${esc(x.severity)}</span></div>`).join(''):'<div class="empty">Chưa có cảnh báo được ghi nhận.</div>'}</div></div>`;}catch(e){root.innerHTML=`<div class="notice error">${esc(e.message)}</div>`;}
}

async function loadDataQuality(){
  const root=$('#page-dataquality');root.innerHTML='<div class="card"><div class="empty">Đang kiểm tra chất lượng dữ liệu…</div></div>';
  try{const r=await api('/api/data-quality');const items=r.data.issues||[];root.innerHTML=`<div class="card"><div class="card-head"><h3>Phát hiện tự động</h3><span class="subtle">${esc(r.data.generated_at||'')}</span></div><div class="rows">${items.length?items.map(x=>`<div class="row"><div class="row-main"><b>${esc(x.title)}</b><small>${esc(x.system.toUpperCase())} · ${esc(x.code)}</small></div><span class="badge ${x.severity==='critical'||x.severity==='high'?'danger':x.severity==='medium'?'warn':'neutral'}">${fmt(x.count)}</span></div>`).join(''):'<div class="empty">Không phát hiện vấn đề trong các kiểm tra hiện có.</div>'}</div></div>`;}catch(e){root.innerHTML=`<div class="notice error">${esc(e.message)}</div>`;}
}

async function loadSecurity(){
  const root=$('#page-security');root.innerHTML='<div class="card"><div class="empty">Đang tải dữ liệu bảo mật…</div></div>';try{const r=await api('/api/security');const systems=r.data.systems||{};root.innerHTML=`<div class="grid4">${Object.entries(systems).flatMap(([sys,v])=>Object.entries(v).map(([k,n])=>`<div class="stat"><small>${esc(sys.toUpperCase())} · ${esc(k)}</small><b>${fmt(n)}</b></div>`)).join('')}</div><div class="card" style="margin-top:16px"><h3>Nguyên tắc bảo mật</h3><p class="subtle">Ops không hiển thị mật khẩu, secret hoặc raw session token. Dữ liệu bảo mật được tổng hợp theo quyền và các thao tác trong Ops đều được audit.</p></div>`;}catch(e){root.innerHTML=`<div class="notice error">${esc(e.message)}</div>`;}
}

async function loadIncidents(){
  const root=$('#page-incidents');root.innerHTML='<div class="card"><div class="empty">Đang tải sự cố…</div></div>';try{const r=await api('/api/incidents');root.innerHTML=`${can('incidents.manage')?'<div class="toolbar"><button id="newIncident" class="btn primary">Tạo sự cố</button></div>':''}<div class="card"><div class="rows">${r.items.length?r.items.map(x=>`<div class="row"><div class="row-main"><b>${esc(x.title)}</b><small>${esc(x.service_id||'Toàn hệ thống')} · ${esc(x.created_at)}</small></div><span class="badge ${x.severity==='critical'||x.severity==='high'?'danger':x.severity==='medium'?'warn':'neutral'}">${esc(x.status)} · ${esc(x.severity)}</span></div>`).join(''):'<div class="empty">Chưa có sự cố được ghi nhận.</div>'}</div></div>`;$('#newIncident')?.addEventListener('click',incidentModal);}catch(e){root.innerHTML=`<div class="notice error">${esc(e.message)}</div>`;}
}
function incidentModal(){modal('Tạo sự cố',`<form id="incidentForm"><div class="field"><label>Tiêu đề</label><input name="title" required></div><div class="split"><div class="field"><label>Mức độ</label><select name="severity"><option>low</option><option selected>medium</option><option>high</option><option>critical</option></select></div><div class="field"><label>Hệ thống</label><select name="service_id"><option value="">Toàn hệ thống</option>${state.services.map(s=>`<option value="${esc(s.id)}">${esc(s.name)}</option>`).join('')}</select></div></div><div class="field"><label>Mô tả</label><textarea name="description" rows="5"></textarea></div><button class="btn primary" type="submit">Tạo sự cố</button></form>`);$('#incidentForm').addEventListener('submit',async e=>{e.preventDefault();const f=new FormData(e.currentTarget);await api('/api/incidents',{method:'POST',body:JSON.stringify(Object.fromEntries(f))});closeModal();toast('Đã tạo sự cố.');loadIncidents();});}

async function loadAudit(){const root=$('#page-audit');root.innerHTML='<div class="card"><div class="empty">Đang tải audit…</div></div>';try{const r=await api('/api/audit');root.innerHTML=`<div class="card table-wrap"><table class="table"><thead><tr><th>Thời gian</th><th>Người thực hiện</th><th>Hành động</th><th>Đối tượng</th></tr></thead><tbody>${r.items.map(x=>`<tr><td>${esc(x.created_at)}</td><td>${esc(x.actor_email||'Hệ thống')}</td><td>${esc(x.action)}</td><td>${esc((x.target_type||'')+' '+(x.target_id||''))}</td></tr>`).join('')}</tbody></table></div>`;}catch(e){root.innerHTML=`<div class="notice error">${esc(e.message)}</div>`;}}

async function loadReports(){const root=$('#page-reports');let list=[];try{const r=await api('/api/reports/snapshots');list=r.items;}catch{}root.innerHTML=`<div class="card"><div class="card-head"><div><h3>Snapshot KPI</h3><div class="subtle">Lưu JSON vào D1 Ops và R2 bucket ops.</div></div>${can('reports.manage')?'<button id="makeSnapshot" class="btn primary">Tạo snapshot ngay</button>':''}</div><div class="rows">${list.length?list.map(x=>`<div class="row"><div class="row-main"><b>${esc(x.captured_at)}</b><small>${esc(x.id)}</small></div><span class="badge ok">Đã lưu</span></div>`).join(''):'<div class="empty">Chưa có snapshot.</div>'}</div></div>`;$('#makeSnapshot')?.addEventListener('click',createSnapshot);}
async function createSnapshot(){try{const r=await api('/api/reports/snapshot',{method:'POST',body:'{}'});toast('Đã lưu snapshot '+r.id);if($('#page-reports').classList.contains('active'))loadReports();}catch(e){toast(e.message);}}

async function loadUsers(){
  const root=$('#page-users');root.innerHTML='<div class="card"><div class="empty">Đang tải tài khoản Ops…</div></div>';try{const [u,roles]=await Promise.all([api('/api/admin/users'),api('/api/roles')]);root.innerHTML=`<div class="toolbar"><button id="newOpsUser" class="btn primary">Tạo tài khoản Ops</button></div><div class="card table-wrap"><table class="table"><thead><tr><th>Họ tên</th><th>Email</th><th>Role</th><th>Trạng thái</th><th>Đăng nhập gần nhất</th></tr></thead><tbody>${u.items.map(x=>`<tr><td>${esc(x.full_name)}</td><td>${esc(x.email)}</td><td>${esc(x.role)}</td><td>${esc(x.status)}</td><td>${esc(x.last_login_at||'—')}</td></tr>`).join('')}</tbody></table></div>`;$('#newOpsUser').addEventListener('click',()=>userModal(roles.roles));}catch(e){root.innerHTML=`<div class="notice error">${esc(e.message)}</div>`;}
}
function userModal(roles){modal('Tạo tài khoản Ops',`<form id="opsUserForm"><div class="field"><label>Họ tên</label><input name="full_name" required></div><div class="field"><label>Email</label><input type="email" name="email" required></div><div class="field"><label>Role</label><select name="role">${roles.map(r=>`<option>${esc(r)}</option>`).join('')}</select></div><div class="field"><label>Mật khẩu tạm (≥12 ký tự)</label><input type="password" name="password" minlength="12" required></div><button class="btn primary">Tạo tài khoản</button></form>`);$('#opsUserForm').addEventListener('submit',async e=>{e.preventDefault();const f=new FormData(e.currentTarget);await api('/api/admin/users',{method:'POST',body:JSON.stringify(Object.fromEntries(f))});closeModal();toast('Đã tạo tài khoản Ops.');loadUsers();});}

async function loadIntegrations(){const root=$('#page-integrations');root.innerHTML='<div class="card"><div class="empty">Đang kiểm tra kết nối…</div></div>';try{const [r,ready]=await Promise.all([api('/api/system/integrations'),api('/api/system/readiness')]);const map=new Map((ready.data.databases||[]).map(x=>[x.service,x]));root.innerHTML=`<div class="card"><div class="card-head"><div><h3>8 nguồn hệ sinh thái</h3><div class="subtle">Kiểm tra binding thật trên môi trường đang chạy.</div></div><span class="badge ${ready.data.ready?'ok':'warn'}">${ready.data.ready?'Sẵn sàng':'Cần cấu hình'}</span></div><div class="rows">${r.items.map(x=>{const d=map.get(x.id);return `<div class="row"><div class="row-main"><b>${esc(x.name)}</b><small>${esc(x.url)} · ${esc(x.database)}</small></div><span class="badge ${d?.ok?'ok':'danger'}">${d?.ok?'Đã kết nối':esc(d?.error||'Chưa kiểm tra')}</span></div>`}).join('')}<div class="row"><div class="row-main"><b>R2 Ops</b><small>Bucket lưu snapshot/báo cáo của Trung tâm Điều hành</small></div><span class="badge ${ready.data.r2?.ok?'ok':'danger'}">${ready.data.r2?.ok?'Đã kết nối':esc(ready.data.r2?.error||'Chưa kết nối')}</span></div></div></div>`;}catch(e){root.innerHTML=`<div class="notice error"><b>Không thể kiểm tra tích hợp.</b><br>${esc(e.message)}</div>`;}}

function modal(title,body){const wrap=document.createElement('div');wrap.className='modal-backdrop';wrap.innerHTML=`<div class="modal"><div class="modal-head"><h3>${esc(title)}</h3><button class="modal-close" aria-label="Đóng">×</button></div>${body}</div>`;document.body.append(wrap);wrap.addEventListener('click',e=>{if(e.target===wrap||e.target.closest('.modal-close'))wrap.remove();});}
function closeModal(){$('.modal-backdrop')?.remove();}

init();
