// Preload with --require for local-only, pinned Babylon 9.32.0 browser checks.
// Distribution files must be downloaded separately with normal TLS verification.
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const {chromium}=require('playwright-core');
const base=new URL(process.env.BASE_URL||'http://127.0.0.1:8025');
if(!['127.0.0.1','localhost','[::1]'].includes(base.hostname))throw Error('Graphics checks require a loopback BASE_URL');
const vendor=path.resolve(process.env.BABYLON_VENDOR_DIR||'graphics-prototype/quaternius-prototypes/evidence/stability-phase2/vendor');
const hashes={
 'babylon.js':'58c486bececb6cde67b188e6410321e72d1d051ea7a9e5f23c560b6049ab37a5',
 'babylonjs.loaders.min.js':'38096724c9dff7584c4e85ba65b34c8f15394e381815c23071761f05c08a192e'
};
const scripts={};
for(const[name,hash]of Object.entries(hashes)){
 const bytes=fs.readFileSync(path.join(vendor,name));
 if(crypto.createHash('sha256').update(bytes).digest('hex')!==hash)throw Error('Unexpected Babylon 9.32.0 distribution: '+name);
 scripts[name]=bytes;
}
const launch=chromium.launch.bind(chromium);
chromium.launch=async options=>{
 const browser=await launch(options),newPage=browser.newPage.bind(browser);
 browser.newPage=async options=>{
  const page=await newPage({...options,serviceWorkers:'block'});
  await page.context().route('**/*',route=>{
   const url=new URL(route.request().url());
   if(url.origin===base.origin)return route.continue();
   if(url.origin==='https://cdn.babylonjs.com'){
    const name={'/babylon.js':'babylon.js','/loaders/babylonjs.loaders.min.js':'babylonjs.loaders.min.js'}[url.pathname];
    if(name)return route.fulfill({contentType:'application/javascript',body:scripts[name]});
   }
   console.error('Blocked external graphics-test request:',url.origin+url.pathname);
   return route.abort('blockedbyclient');
  });
  return page;
 };
 return browser;
};
