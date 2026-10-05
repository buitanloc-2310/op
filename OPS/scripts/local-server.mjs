// Local SQLite adapter for development; never connects to live D1 or live R2.
import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import app from '../src/index.js';
import {database} from '../tests/db.mjs';
const env={OPS_DB:database(process.env.OPS_LOCAL_DB||':memory:'),SETUP_SECRET:process.env.OPS_SETUP_SECRET||'local-setup-only'};
const port=Number(process.env.PORT||8788);
const nativeFetch=globalThis.fetch;
// Health checks are deliberately unavailable in the offline local environment.
globalThis.fetch=(url,opts)=>new URL(typeof url==='string'?url:url.url).hostname.endsWith('skyfirst.io.vn')?Promise.resolve(Response.json({ok:false,local:true},{status:503})):nativeFetch(url,opts);
const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.webp':'image/webp'};
http.createServer(async(req,res)=>{try{const url=new URL(req.url,`http://localhost:${port}`);if(url.pathname.startsWith('/api/')){const chunks=[];for await(const c of req)chunks.push(c);const request=new Request(url,{method:req.method,headers:req.headers,body:chunks.length?Buffer.concat(chunks):undefined});const result=await app.fetch(request,env);res.writeHead(result.status,Object.fromEntries(result.headers));res.end(Buffer.from(await result.arrayBuffer()));}else{const filename=path.resolve('public','.'+(url.pathname==='/'?'/index.html':url.pathname));if(!filename.startsWith(path.resolve('public')+path.sep))throw Error();const content=await fs.readFile(filename);res.writeHead(200,{'content-type':mime[path.extname(filename)]||'application/octet-stream','content-security-policy':"default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; object-src 'none'"});res.end(content);}}catch{res.writeHead(404);res.end('Not found');}}).listen(port,'127.0.0.1',()=>console.log(`Local OPS: http://localhost:${port} — setup code: ${env.SETUP_SECRET}`));
