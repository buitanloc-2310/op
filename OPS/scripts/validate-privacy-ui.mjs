import fs from 'node:fs';
const app=fs.readFileSync('public/app.js','utf8'),idx=fs.readFileSync('src/index.js','utf8'),html=fs.readFileSync('public/index.html','utf8');
const checks=[
['canonical domain',html.includes('https://ops.skyfirst.io.vn/')],
['private robots',html.includes('noindex,nofollow')],
['copyright block',app.includes('Bản quyền & Sử dụng')],
['no social quick login',!app.includes('Google')&&!app.includes('Microsoft')],
['new audit nav',app.includes("['audit','⌁','Lịch sử hoạt động'")],
['new incidents nav',app.includes("['incidents','⚠','Sự cố vận hành'")],
['integration UI redacted',app.includes('không công khai thông tin cấu hình nội bộ')],
['integrations hide urls',!/name:s\.name,url:s\.url/.test(idx)],
['public health hides version',!/version:'1\.1\.1'/.test(idx)],
['readiness hides binding names',!/binding:bindingName/.test(idx)],
['readiness hides raw errors',!/error:String\(e\?\.message/.test(idx)]
];
let p=0;for(const [n,ok] of checks){if(ok)p++;else console.error('FAIL',n)}console.log(`Privacy/UI validation: ${p}/${checks.length} PASS`);if(p!==checks.length)process.exit(1);
