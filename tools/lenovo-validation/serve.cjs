'use strict';
const http=require('node:http'),fs=require('node:fs'),path=require('node:path');
const {verify}=require('./verify.cjs');
const types={'.html':'text/html; charset=utf-8','.js':'application/javascript','.cjs':'text/plain','.css':'text/css','.json':'application/json','.glb':'model/gltf-binary','.png':'image/png','.jpg':'image/jpeg','.md':'text/plain; charset=utf-8','.txt':'text/plain; charset=utf-8'};
async function startServer(port=0){
 const inventory=verify(),allowed=new Set(Object.keys(inventory.files));
 const server=http.createServer((req,res)=>{
  res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');
  res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self'; connect-src 'self'; img-src 'self' data: blob:; style-src 'self' 'unsafe-inline'; object-src 'none'; frame-src 'none'; base-uri 'self'; form-action 'none'");
  if(!['GET','HEAD'].includes(req.method)){res.writeHead(405);return res.end();}
  let name;try{name=decodeURIComponent(new URL(req.url,'http://127.0.0.1').pathname).slice(1)||'index.html';}catch{res.writeHead(400);return res.end();}
  if(name.endsWith('/'))name+='index.html';
  if(!allowed.has(name)){res.writeHead(404);return res.end('Not part of the isolated showroom package');}
  res.setHeader('Content-Type',types[path.extname(name)]||'application/octet-stream');
  if(req.method==='HEAD')return res.end();
  fs.createReadStream(path.join(__dirname,name)).on('error',()=>res.destroy()).pipe(res);
 });
 await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(port,'127.0.0.1',resolve);});
 return {server,origin:'http://127.0.0.1:'+server.address().port};
}
if(require.main===module){const port=Number(process.argv[2]||8025);startServer(port).then(({origin})=>console.log('Showroom only: '+origin+'/graphics-prototype/quaternius-prototypes/\nStop with Ctrl+C. No external assets or backend access.')).catch(e=>{console.error(e.message);process.exitCode=1;});}
module.exports={startServer};
