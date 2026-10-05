export const SERVICES = [
  { id: 'slc', name: 'Trung tâm Học tập số', short: 'SLC', url: 'https://slc.skyfirst.io.vn', health: 'https://slc.skyfirst.io.vn/api/health', color: '#0d63c9' },
  { id: 'exam', name: 'Trung tâm Dự thi', short: 'Exam', url: 'https://exam.skyfirst.io.vn', health: 'https://exam.skyfirst.io.vn/health', color: '#5b5bd6' },
  { id: 'member', name: 'Trung tâm Thành viên số', short: 'Member', url: 'https://member.skyfirst.io.vn', health: 'https://member.skyfirst.io.vn/', color: '#0a8f73' },
  { id: 'tnv', name: 'Trung tâm Tình nguyện viên', short: 'TNV', url: 'https://tnv.skyfirst.io.vn', health: 'https://tnv.skyfirst.io.vn/api/status', color: '#e07917' },
  { id: 'ctt', name: 'Cổng Thông tin SFN', short: 'CTT', url: 'https://ctt.skyfirst.io.vn', health: 'https://ctt.skyfirst.io.vn/api/health', color: '#1363a7' },
  { id: 'web', name: 'Website chính Sky First', short: 'Website', url: 'https://skyfirst.io.vn', health: 'https://skyfirst.io.vn/', color: '#334155' },
  { id: 'sfec', name: 'The Sky First English Club', short: 'SFEC', url: 'https://sfec.skyfirst.io.vn', health: 'https://sfec.skyfirst.io.vn/api/health', color: '#147a9c' },
  { id: 'mail', name: 'Sky First Mail', short: 'Mail', url: 'https://mail.skyfirst.io.vn', health: 'https://mail.skyfirst.io.vn/api/health', color: '#8b5cf6' }
];

const m = (system, id, name, description, category, path = '', manage = true) => ({
  id: `${system}.${id}`,
  system,
  name,
  description,
  category,
  view_cap: `${system}.${id}.view`,
  manage_cap: manage ? `${system}.${id}.manage` : null,
  path
});

export const MODULES = [
  // SLC
  m('slc','accounts','Tài khoản & hồ sơ','Hồ sơ cá nhân, mật khẩu, avatar, phiên đăng nhập, yêu cầu cấp tài khoản.','Tài khoản','#account'),
  m('slc','organizations','Tổ chức & gói quyền','Tổ chức, thành viên tổ chức, branding, subscription, quota và entitlement.','Tổ chức','#organizations'),
  m('slc','users','Người dùng & phân quyền','Tạo tài khoản, tạo hàng loạt, trạng thái tài khoản, vai trò và quyền mở rộng.','Nhân sự','#admin-users'),
  m('slc','classes','Lớp học','Tạo lớp, hồ sơ lớp, thành viên, mã tham gia, quyền trong lớp và trạng thái lớp.','Giáo dục','#classes'),
  m('slc','materials','Học liệu & tài nguyên','Học liệu, thư mục tài nguyên, file, bài học và learning units.','Giáo dục','#resources'),
  m('slc','assignments','Bài tập & bài nộp','Bài tập, deadline, bài nộp, tệp đính kèm, chấm và phản hồi.','Giáo dục','#assignments'),
  m('slc','gradebook','Sổ điểm','Nhóm điểm, trọng số, điểm bài tập, thay đổi điểm và tổng hợp kết quả.','Giáo dục','#gradebook'),
  m('slc','attendance','Điểm danh','Phiên điểm danh, bản ghi điểm danh, ghi chú và lịch sử.','Giáo dục','#attendance'),
  m('slc','calendar','Lịch lớp & lịch hệ thống','Sự kiện lớp, lịch học, lịch thi và lịch điều hành liên quan.','Giáo dục','#calendar'),
  m('slc','progress','Tiến độ học tập','Tiến độ bài học, mức hoàn thành, lesson progress và analytics học tập.','Giáo dục','#progress'),
  m('slc','discussion','Thảo luận lớp','Bài đăng, tin nhắn lớp và tương tác học tập.','Giáo dục','#discussion'),
  m('slc','live','Live Classroom','Phòng học trực tuyến, waiting room, attendance live, poll, raise hand, resource và realtime.','Live','#live'),
  m('slc','assessment','Assessment Center','Tạo kỳ thi, cấu hình, lịch thi, publish, giám sát, chấm và kết quả.','Kỳ thi','#assessment-center'),
  m('slc','questionbank','Ngân hàng câu hỏi','Question bank, section, competency, import và quản trị câu hỏi.','Kỳ thi','#question-bank'),
  m('slc','examops','Điều hành kỳ thi','Attempt, guest attempt, launch token, integrity, receipt, appeal và audit kỳ thi.','Kỳ thi','#exam-center'),
  m('slc','certificates','Chứng nhận','Cấp, quản lý và tra cứu chứng nhận liên quan học tập.','Chứng nhận','#certificates'),
  m('slc','notifications','Thông báo','Notification center, trạng thái đọc và liên kết thông báo.','Giao tiếp','#notifications'),
  m('slc','support','Hỗ trợ','Ticket hỗ trợ, phân công, trao đổi và trạng thái xử lý.','Hỗ trợ','#support'),
  m('slc','files','File & lưu trữ','File, R2, quota và resource usage.','Hệ thống','#files'),
  m('slc','search','Tìm kiếm','Tìm kiếm nội dung và dữ liệu trong nền tảng.','Hệ thống','#search',false),
  m('slc','analytics','Analytics & KPI','Overview, analytics v39, usage và hoạt động nền tảng.','Điều hành','#admin-analytics'),
  m('slc','automation','Tự động hóa','Automation rules, automation runs và tác vụ định kỳ.','Điều hành','#admin-automations'),
  m('slc','audit','Audit & hoạt động quản trị','Audit log, admin activity, assessment audit và platform audit.','Bảo mật','#admin-activity'),
  m('slc','security','Chính sách & bảo mật','Policies, role assignments, custom roles, session và login throttle.','Bảo mật','#admin-policies'),
  m('slc','system','System Admin','Diagnostics, cleanup, live metrics, upgrade, settings và system jobs.','Hệ thống','#admin-system'),
  m('slc','email','Email hệ thống','Email template, email logs và kiểm thử gửi email.','Hệ thống','#admin-email'),
  m('slc','website','Website Studio','Website revisions và công cụ chỉnh giao diện trong SLC.','Nội dung','#website-studio'),
  m('slc','command','Command Center','Truy cập nhanh, tìm lệnh và tác vụ quản trị.','Điều hành','#command-center',false),

  // Exam
  m('exam','entry','Vào kỳ thi','Nhận link/mã dự thi, launch từ SLC và điều hướng vào bài thi.','Dự thi','/'),
  m('exam','identity','Xác minh thí sinh','Thông tin thí sinh khách và xác minh theo chính sách kỳ thi.','Dự thi','/'),
  m('exam','player','Exam Player','Làm bài một câu/màn hình, điều hướng, đánh dấu và timer.','Dự thi','/'),
  m('exam','autosave','Autosave & Recovery','Tự lưu, lưu cục bộ và khôi phục bài khi refresh/mất kết nối.','Dự thi','/'),
  m('exam','integrity','Integrity & Strict Mode','Fullscreen, sự kiện integrity và giám sát hành vi theo cấu hình.','Dự thi','/'),
  m('exam','submit','Nộp bài & biên nhận','Xác nhận nộp, receipt, màn hoàn tất và kết quả theo policy.','Dự thi','/'),
  m('exam','health','Health','Trạng thái runtime của Exam.','Hệ thống','/health',false),

  // Member
  m('member','accountrequests','Yêu cầu cấp tài khoản','Tiếp nhận, tra cứu và duyệt yêu cầu tài khoản thành viên.','Tài khoản','#account-requests'),
  m('member','directory','Danh bạ thành viên','Danh bạ và tra cứu thành viên theo phạm vi quyền.','Nhân sự','#directory'),
  m('member','profile','Hồ sơ thành viên','Thông tin cá nhân, avatar và dữ liệu hồ sơ thành viên.','Nhân sự','#profile'),
  m('member','org','Đơn vị & chức vụ','Cơ cấu đơn vị, membership, chức vụ và phạm vi hoạt động.','Nhân sự','#organization'),
  m('member','history','Quá trình công tác','Journey, lịch sử hoạt động và quá trình tham gia.','Nhân sự','#journey'),
  m('member','cv','CV thành viên','CV điện tử và xuất CV.','Nhân sự','#cv'),
  m('member','cards','Thẻ thành viên','Loại thẻ và thẻ thành viên.','Nhân sự','#cards'),
  m('member','goals','Mục tiêu','Mục tiêu cá nhân và tiến độ.','Công việc','#goals'),
  m('member','tasks','Công việc','Nhiệm vụ, trạng thái và tiến độ.','Công việc','#tasks'),
  m('member','activities','Hoạt động','Hoạt động và người tham gia.','Hoạt động','#activities'),
  m('member','achievements','Thành tích','Thành tích, ghi nhận và lịch sử.','Hoạt động','#achievements'),
  m('member','documents','Tài liệu','Tài liệu thành viên và tệp liên quan.','Tài liệu','#documents'),
  m('member','certificates','Chứng nhận','Chứng nhận nội bộ, bên ngoài và xác minh.','Chứng nhận','#certificates'),
  m('member','evaluations','Đánh giá','Đánh giá thành viên và dữ liệu dài hạn.','Nhân sự','#evaluations'),
  m('member','calendar','Lịch','Lịch cá nhân và lịch quản trị.','Công việc','#calendar'),
  m('member','notifications','Thông báo','Thông báo thành viên.','Giao tiếp','#notifications'),
  m('member','support','Hỗ trợ','Ticket hỗ trợ của thành viên.','Hỗ trợ','#support'),
  m('member','security','Security Center','Security events, session, revoke session và mật khẩu.','Bảo mật','#security'),
  m('member','audit','Audit','Audit quản trị thành viên.','Bảo mật','#admin-audit'),
  m('member','super','Super Admin','Overview, inspect account, meta và quản trị cấp cao.','Hệ thống','#admin'),

  // TNV
  m('tnv','applications','Hồ sơ TNV','Đăng ký, tra cứu, xét duyệt và trạng thái hồ sơ tình nguyện viên.','Tình nguyện','#applications'),
  m('tnv','opportunities','Cơ hội tình nguyện','Danh sách cơ hội, thời gian, đơn vị và trạng thái tuyển.','Tình nguyện','#opportunities'),
  m('tnv','profile','Hồ sơ TNV','Hồ sơ cá nhân và đơn vị của TNV.','Tình nguyện','#profile'),
  m('tnv','tasks','Nhiệm vụ TNV','Phân công nhiệm vụ, deadline và trạng thái.','Tình nguyện','#tasks'),
  m('tnv','activities','Hoạt động của tôi','Lịch sử và hoạt động TNV.','Tình nguyện','#activities'),
  m('tnv','units','Đơn vị','Đơn vị tổ chức và phạm vi quản trị.','Tổ chức','#units'),
  m('tnv','certificates','Tra cứu chứng nhận','Tra cứu chứng nhận công khai và dữ liệu chứng nhận TNV.','Chứng nhận','#certificates'),
  m('tnv','users','Tài khoản TNV/Admin','Người dùng, trạng thái và phân loại volunteer/admin.','Tài khoản','#admin-users'),
  m('tnv','audit','Audit TNV','Audit log hoạt động quản trị.','Bảo mật','#admin-audit'),
  m('tnv','dashboard','Dashboard TNV','Tổng quan vận hành tình nguyện viên.','Điều hành','#dashboard',false),

  // CTT
  m('ctt','recruitment','Tuyển dụng & ứng tuyển','Form tuyển dụng, submissions, interviews và đánh giá.','Nhân sự','#recruitment'),
  m('ctt','hr','Hồ sơ nhân sự','People, lịch sử, đơn vị, chức vụ và hồ sơ nhân sự.','Nhân sự','#people'),
  m('ctt','forms','Form Builder','Tạo biểu mẫu, phiên bản form và submissions.','Biểu mẫu','#forms'),
  m('ctt','approvals','Trung tâm phê duyệt','Approval workflow, người duyệt, deadline và quyết định.','Điều hành','#approvals'),
  m('ctt','tasks','Nhiệm vụ','Nhiệm vụ, priority, deadline và người phụ trách.','Điều hành','#tasks'),
  m('ctt','classes','Lớp & ghi danh','Lớp, enrollment, teaching scope và điểm danh.','Giáo dục','#classes'),
  m('ctt','events','Sự kiện & check-in','Sự kiện, đăng ký, check-in và feedback.','Sự kiện','#events'),
  m('ctt','certificates','GCN/GXN','Cấp, duyệt, tra cứu, lịch sử và file chứng nhận.','Chứng nhận','#certificates'),
  m('ctt','content','Tin tức & nội dung','News, modules và nội dung công khai.','Nội dung','#content'),
  m('ctt','files','File & Media','Upload, files, media và R2.','Tài liệu','#files'),
  m('ctt','search','Tìm kiếm','Tìm kiếm dữ liệu quản trị.','Điều hành','#search',false),
  m('ctt','export','Xuất dữ liệu','Export submissions và dữ liệu quản trị.','Báo cáo','#export'),
  m('ctt','tickets','Hỗ trợ','Ticket, phân công và trao đổi hỗ trợ.','Hỗ trợ','#tickets'),
  m('ctt','notifications','Thông báo','Thông báo và trạng thái đọc.','Giao tiếp','#notifications'),
  m('ctt','requests','Yêu cầu nội bộ & dữ liệu','Internal requests và data requests.','Điều hành','#requests'),
  m('ctt','email','Email logs & templates','Template, log gửi mail và trạng thái delivery.','Hệ thống','#email'),
  m('ctt','backup','Backup','Backup, restore metadata và lịch sử backup.','Hệ thống','#backups'),
  m('ctt','audit','Audit','Audit toàn cổng thông tin.','Bảo mật','#audit'),
  m('ctt','security','Auth, 2FA & session','Đăng nhập, Google OAuth, 2FA, phiên và reset mật khẩu.','Bảo mật','#security'),
  m('ctt','settings','Thiết lập & điều khoản','Settings, terms, modules và cấu hình cổng.','Hệ thống','#settings'),

  // Website
  m('web','cms','CMS','Quản lý site config và tài liệu CMS.','Nội dung','/admin'),
  m('web','news','Tin tức','Bài viết, nội dung và hiển thị tin tức.','Nội dung','/admin'),
  m('web','programs','Chương trình/Dự án','Quản lý chương trình, dự án và trang chi tiết.','Nội dung','/admin'),
  m('web','units','Đơn vị','Quản lý các đơn vị/nhánh trên website.','Nội dung','/admin'),
  m('web','pages','Trang nội dung','Giới thiệu, liên hệ, tham gia, tài trợ, chứng nhận và các trang độc lập.','Nội dung','/admin'),
  m('web','visual','Visual Website Editor','Chỉnh giao diện, layout và nội dung toàn cục.','Nội dung','/admin'),
  m('web','media','Media','Upload và quản lý media.','Tài liệu','/admin'),
  m('web','registrations','Đăng ký chương trình','Hồ sơ đăng ký và danh sách người tham gia.','Cộng đồng','/admin'),
  m('web','contacts','Liên hệ','Tin nhắn liên hệ từ website.','Cộng đồng','/admin'),
  m('web','comments','Bình luận','Bình luận tin tức và moderation.','Cộng đồng','/admin'),
  m('web','adminusers','Admin Website','Người dùng quản trị, role và mật khẩu.','Hệ thống','/admin'),
  m('web','records','Admin Records','Record quản trị và dữ liệu nội bộ website.','Hệ thống','/admin'),
  m('web','audit','Audit Website','Lịch sử thao tác admin.','Bảo mật','/admin'),
  m('web','health','System Health','Tình trạng website và release.','Hệ thống','/admin',false),

  // SFEC
  m('sfec','recruitment','Tuyển TNV/Thành viên','Form, submissions, interview và quy trình tuyển.','Nhân sự','#recruitment'),
  m('sfec','people','Hồ sơ SFEC','People, chức vụ, lịch sử và thông tin thành viên.','Nhân sự','#people'),
  m('sfec','classes','Lớp học SFEC','Lớp, enrollment, teaching scope và vận hành lớp.','Giáo dục','#classes'),
  m('sfec','attendance','Điểm danh','Điểm danh học viên và lịch sử.','Giáo dục','#attendance'),
  m('sfec','forms','Biểu mẫu','Form builder và submissions.','Biểu mẫu','#forms'),
  m('sfec','events','Hoạt động & sự kiện','Sự kiện, đăng ký, check-in và hoạt động CLB.','Sự kiện','#events'),
  m('sfec','certificates','GCN/GXN SFEC','Cấp, duyệt, tra cứu và xác minh chứng nhận.','Chứng nhận','#certificates'),
  m('sfec','approvals','Phê duyệt','Workflow phê duyệt nội bộ SFEC.','Điều hành','#approvals'),
  m('sfec','tasks','Nhiệm vụ','Nhiệm vụ, deadline và người phụ trách.','Điều hành','#tasks'),
  m('sfec','content','CMS & Website Studio','Tin tức, site pages, revision và nội dung website SFEC.','Nội dung','#site-studio'),
  m('sfec','files','File & Media','Upload, files và media.','Tài liệu','#files'),
  m('sfec','tickets','Hỗ trợ','Ticket hỗ trợ và phản hồi.','Hỗ trợ','#tickets'),
  m('sfec','notifications','Thông báo','Thông báo nội bộ và trạng thái đọc.','Giao tiếp','#notifications'),
  m('sfec','email','Email logs & templates','Template và log email SFEC.','Hệ thống','#email'),
  m('sfec','backup','Backup','Backup và lịch sử backup.','Hệ thống','#backups'),
  m('sfec','audit','Audit SFEC','Audit log toàn SFEC.','Bảo mật','#audit'),
  m('sfec','security','Auth, 2FA & session','Đăng nhập, 2FA, session và reset mật khẩu.','Bảo mật','#security'),
  m('sfec','settings','Cấu hình SFEC','Settings, terms, modules và cấu hình.','Hệ thống','#settings'),

  // Mail
  m('mail','mailbox','Hộp thư','Inbox, Sent, Spam, Trash, Starred và mailbox summary.','Email','/'),
  m('mail','messages','Thư & hội thoại','Đọc thư, thread, trạng thái read/star và bulk actions.','Email','/'),
  m('mail','compose','Soạn & gửi thư','Compose, attachment và gửi nội bộ/bên ngoài.','Email','/'),
  m('mail','drafts','Bản nháp','Lưu và quản lý draft.','Email','/'),
  m('mail','contacts','Danh bạ','Contacts và directory.','Email','/'),
  m('mail','labels','Nhãn','Labels và message labels.','Email','/'),
  m('mail','signatures','Chữ ký','Quản lý chữ ký email.','Email','/'),
  m('mail','aliases','Alias','Alias và sender identity.','Email','/'),
  m('mail','rules','Rules','Quy tắc xử lý mail.','Email','/'),
  m('mail','templates','Mẫu email','Mail templates.','Email','/'),
  m('mail','notifications','Thông báo','Thông báo của Mail.','Giao tiếp','/'),
  m('mail','sessions','Phiên đăng nhập','Session, revoke session và bảo mật truy cập.','Bảo mật','/'),
  m('mail','profile','Hồ sơ Mail','Tên hiển thị, avatar, password và trạng thái.','Tài khoản','/'),
  m('mail','adminusers','Quản trị người dùng Mail','Users, status, role và mailbox.','Hệ thống','/'),
  m('mail','domains','Tên miền Mail','Managed domains và cấu hình domain.','Hệ thống','/'),
  m('mail','delivery','Delivery & logs','Delivery events, provider status và audit.','Hệ thống','/'),
  m('mail','system','System Admin Mail','Dashboard, usage, settings và system health.','Hệ thống','/'),
  m('mail','audit','Audit Mail','Audit log và login history.','Bảo mật','/'),
];

export const ROLE_CAPABILITIES = {
  super_admin: ['*'],
  executive: ['overview.view','health.view','alerts.view','incidents.view','reports.view','search.global','*.view'],
  system_admin: ['overview.view','health.*','alerts.*','incidents.*','reports.*','search.global','security.*','audit.*','ops.*','*.view','mail.system.manage','mail.adminusers.manage','mail.domains.manage','slc.system.manage','slc.security.manage'],
  education_admin: ['overview.view','health.view','alerts.view','reports.view','search.global','slc.*','exam.*','sfec.classes.*','sfec.attendance.*','sfec.certificates.view','ctt.classes.*'],
  hr_admin: ['overview.view','alerts.view','reports.view','search.global','member.*','tnv.*','ctt.hr.*','ctt.recruitment.*','ctt.approvals.*','ctt.certificates.*','sfec.people.*','sfec.recruitment.*'],
  communications_admin: ['overview.view','reports.view','search.global','web.*','ctt.content.*','ctt.files.*','sfec.content.*','sfec.files.*'],
  auditor: ['overview.view','health.view','alerts.view','incidents.view','reports.view','search.global','audit.view','security.view','*.view'],
  viewer: ['overview.view','health.view']
};

export function globMatch(pattern, value) {
  if (pattern === '*') return true;
  const escaped = pattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*');
  return new RegExp(`^${escaped}$`).test(value);
}

export function userCapabilities(user) {
  const base = ROLE_CAPABILITIES[user?.role] || ROLE_CAPABILITIES.viewer;
  let extra = [];
  try { extra = JSON.parse(user?.capabilities_json || '[]'); } catch {}
  return [...new Set([...base, ...(Array.isArray(extra) ? extra.filter(x=>typeof x==='string') : [])])];
}

export function can(user, capability) {
  if (!user) return false;
  return userCapabilities(user).some(p => globMatch(p, capability));
}

export function visibleCatalog(user) {
  return MODULES.filter(x => can(user, x.view_cap)).map(x => ({
    ...x,
    can_manage: Boolean(x.manage_cap && can(user, x.manage_cap)),
    url: `${SERVICES.find(s => s.id === x.system)?.url || ''}${x.path || ''}`
  }));
}
