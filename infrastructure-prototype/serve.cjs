'use strict';
// Loopback-only server, deliberately restricted to the standalone prototype.
const http=require('node:http'),fs=require('node:fs'),path=require('node:path');
const root=__dirname,allowed=new Set(['index.html','style.css','core.js','app.js']),types={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'application/javascript; charset=utf-8'};
function serve(port=8044){const server=http.createServer((req,res)=>{const name=new URL(req.url,'http://localhost').pathname.slice(1)||'index.html';if(!['GET','HEAD'].includes(req.method)||!allowed.has(name)){res.writeHead(404);return res.end();}res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Content-Type',types[path.extname(name)]);if(req.method==='HEAD')return res.end();fs.createReadStream(path.join(root,name)).pipe(res);});return new Promise(resolve=>server.listen(port,'127.0.0.1',()=>resolve(server)));}
if(require.main===module)serve(Number(process.argv[2]||8044)).then(s=>console.log('Isolated prototype: http://127.0.0.1:'+s.address().port));module.exports={serve};
