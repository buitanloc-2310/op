import fs from 'node:fs';
const app=fs.readFileSync('public/app.js','utf8'),idx=fs.readFileSync('src/index.js','utf8'),html=fs.readFileSync('public/index.html','utf8');
const checks=[
['canonical domain',html.includes('https://ops.skyfirst.io.vn/')],
['private robots',html.includes('noindex,nofollow')],
['copyright block',app.includes('Bản quyền & Sử dụng')],
['no social quick login',!app.includes('Google')&&!app.includes('Microsoft')],
['audit nav friendly',app.includes("['audit','⌁','Lịch sử hoạt động'")],
['incidents nav friendly',app.includes("['incidents','⚠','Sự cố vận hành'")],
['no D1 binding UI error',!app.includes('Kiểm tra D1/binding')],
['no access-scope discussion copy',!app.includes('Nội dung hiển thị theo phạm vi truy cập')&&!app.includes('Nội dung chỉ hiển thị theo quyền')],
['no internal-config discussion copy',!app.includes('không công khai thông tin cấu hình nội bộ')],
['integrations hide urls',!/name:s\.name,url:s\.url/.test(idx)],
['public health hides version',!/version:'1\.1\.1'/.test(idx)],
['readiness hides binding names',!/binding:bindingName/.test(idx)],
['readiness hides raw errors',!/error:String\(e\?\.message/.test(idx)],
['query helper accepts selector roots',app.includes("typeof root === 'string' ? document.querySelector(root) : root")],
['no browser prompt',!app.includes('prompt(')&&!app.includes('confirm(')&&!app.includes('alert(')]
];
let p=0;for(const [n,ok] of checks){if(ok)p++;else console.error('FAIL',n)}console.log(`Privacy/UI validation: ${p}/${checks.length} PASS`);if(p!==checks.length)process.exit(1);
