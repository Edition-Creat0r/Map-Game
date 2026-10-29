// Pure presentation/progress/backup contracts. No economic rewards or simulation.
(function (root) {
  'use strict';
  const KEYS = ['mapgame_economy_021e','mapGame_alpha021_firstPlayable','mapgame_world_seed','mapgame_frontier_world_v1'];
  const JOURNAL = 'mapgame_frontier_restore_journal_v1';
  const MAX_BYTES = 32 * 1024 * 1024;
  const goals = [
    {id:'firstHome',name:'A place to begin',branch:'Civilization',tier:'Task',metric:'homes',target:1,pre:[],text:'Build your first residential building.'},
    {id:'neighborhood',name:'A growing neighborhood',branch:'Civilization',tier:'Milestone',metric:'homes',target:5,pre:['firstHome'],text:'Give your settlement five residential buildings.'},
    {id:'population',name:'People of the frontier',branch:'Civilization',tier:'Milestone',metric:'population',target:50,pre:['firstHome'],text:'Reach a housed population of 50.'},
    {id:'power',name:'Light the valley',branch:'Energy',tier:'Task',metric:'power',target:1,pre:[],text:'Build a small power plant.'},
    {id:'powerNetwork',name:'Powering tomorrow',branch:'Energy',tier:'Milestone',metric:'power',target:3,pre:['power'],text:'Build three small power plants.'},
    {id:'steel',name:'First steel',branch:'Industry',tier:'Task',metric:'steelFactories',target:1,pre:['power'],text:'Build a starter steel factory.'},
    {id:'carbon',name:'Carbon works',branch:'Industry',tier:'Task',metric:'carbonFactories',target:1,pre:['power'],text:'Build a starter carbon facility.'},
    {id:'industry',name:'An industrial horizon',branch:'Industry',tier:'Legendary',metric:'industrial',target:10,hidden:true,pre:['steel','carbon'],text:'Build ten industrial-catalog factories.'},
    {id:'trade',name:'Open for business',branch:'Civilization',tier:'Task',metric:'commercial',target:1,pre:['firstHome'],text:'Build a commercial building.'},
    {id:'explore',name:'Beyond the horizon',branch:'Exploration',tier:'Task',metric:'territories',target:1,pre:[],text:'Enter a local territory after this update.'},
    {id:'explorer',name:'A wider world',branch:'Exploration',tier:'Milestone',metric:'territories',target:5,pre:['explore'],text:'Visit five different territories after this update.'},
    {id:'research',name:'A spark of invention',branch:'Technology',tier:'Task',metric:'research',target:1,pre:[],text:'Complete your first research technology.'},
    {id:'innovator',name:'Frontier innovator',branch:'Technology',tier:'Legendary',metric:'research',target:7,pre:['research'],text:'Complete all seven introductory research nodes.'},
    {id:'metallurgyLicense',name:'Beyond ordinary steel',branch:'Technology',tier:'Milestone',metric:'advancedMetallurgy',target:1,pre:['research'],text:'Complete Advanced Metallurgy research.'},
    {id:'fabricationLicense',name:'Precision frontier',branch:'Technology',tier:'Milestone',metric:'precisionFabrication',target:1,pre:['metallurgyLicense'],text:'Complete Precision Fabrication research.'},
    {id:'automationLicense',name:'An automated future',branch:'Technology',tier:'Legendary',metric:'industrialAutomation',target:1,pre:['fabricationLicense'],text:'Complete Industrial Automation research. Recognition only; no production bonus.'},
  ];
  function object(v) { return v && typeof v==='object' && !Array.isArray(v); }
  function safeJSON(text) {
    if (typeof text!=='string' || text.length>MAX_BYTES) throw Error('File exceeds the 32 MB limit.');
    const v=JSON.parse(text);
    function check(x, depth=0) {
      if(depth>64) throw Error('File nesting is too deep.');
      if(x && typeof x==='object') for(const k of Object.keys(x)) {
        if(['__proto__','constructor','prototype'].includes(k)) throw Error('Unsafe property in file.');
        check(x[k],depth+1);
      }
    }
    check(v); return v;
  }
  function validateWorld(v) {
    if(!object(v) || v.version!==1 || typeof v.worldId!=='string' || !/^[a-zA-Z0-9_-]{1,80}$/.test(v.worldId)) throw Error('Unsupported advancement world record.');
    if(!object(v.progress) || v.progress.version!==1) throw Error('Unsupported advancement state.');
    if(v.progress) for(const key of ['completed','explored','pins']) if(v.progress[key]!==undefined && (!Array.isArray(v.progress[key]) || v.progress[key].some(x=>typeof x!=='string'||x.length>100))) throw Error('Invalid advancement list.');
    if(v.progress?.pins?.length>3) throw Error('Only three goals can be pinned.');
    return v;
  }
  function validateBackup(text, schema=4) {
    const v=safeJSON(text);
    if(!object(v) || v.format!=='mapgame-singleplayer-backup' || v.version!==1 || v.scope!=='singleplayer' || !object(v.records)) throw Error('Not a compatible Singleplayer world backup.');
    if(Object.keys(v.records).some(k=>!KEYS.includes(k)) || !KEYS.every(k=>Object.hasOwn(v.records,k))) throw Error('Backup has unsupported or missing storage keys.');
    for(const k of KEYS) if(v.records[k]!==null && typeof v.records[k]!=='string') throw Error('Invalid backup record.');
    for(const k of KEYS.filter(k=>!k.includes('world_seed'))) if(v.records[k]!==null) {
      const raw=safeJSON(v.records[k]);
      if(!object(raw)) throw Error('Invalid world data.');
      if(k===KEYS[0]) {
        if(raw.economy!==undefined && (!object(raw.economy) || !Number.isInteger(raw.economy.version) || raw.economy.version<0 || raw.economy.version>schema)) throw Error('Economy save is from an unsupported version.');
        if(raw.placedIncomeItems!==undefined && !Array.isArray(raw.placedIncomeItems)) throw Error('Invalid building records.');
        for(const key of ['money','steel','carbon','iron','concrete','glass','totalEarned']) if(raw[key]!==undefined&&(typeof raw[key]!=='number'||!Number.isFinite(raw[key])||raw[key]<0||raw[key]>1e12))throw Error('Invalid resource balance.');
        if(raw.inventory!==undefined&&!object(raw.inventory))throw Error('Invalid inventory.');
        if(raw.inventory)for(const value of Object.values(raw.inventory))if(typeof value==='number'&&(!Number.isFinite(value)||value<0||value>1e12))throw Error('Invalid inventory balance.');
        const ids=new Set();for(const row of raw.placedIncomeItems||[]){if(!object(row)||typeof row.id!=='string'||!row.id||ids.has(row.id)||typeof row.type!=='string')throw Error('Invalid or duplicate building identity.');ids.add(row.id);for(const k of ['x','z','rotation'])if(row[k]!==undefined&&(typeof row[k]!=='number'||!Number.isFinite(row[k])))throw Error('Invalid building coordinates.');}

      }
      if(k===KEYS[1]) {
        for(const a of ['claims','buildings']) if(raw[a]!==undefined&&!Array.isArray(raw[a])) throw Error('Invalid world records.');
      }
      if(k===KEYS[3]) validateWorld(raw);
    }
    const seed=v.records[KEYS[2]];
    if(seed!==null && (!/^-?\d{1,10}$/.test(seed) || !Number.isInteger(Number(seed)) || Number(seed)<-2147483648 || Number(seed)>2147483647)) throw Error('Invalid world seed.');
    return v;
  }
  function snapshot(storage, now=Date.now()) {
    const records=Object.fromEntries(KEYS.map(k=>[k,storage.getItem(k)]));
    return validateBackup(JSON.stringify({format:'mapgame-singleplayer-backup',version:1,scope:'singleplayer',createdAt:now,records}));
  }
  function restore(storage, input, schema=4) {
    const data=validateBackup(typeof input==='string'?input:JSON.stringify(input),schema);
    const before=snapshot(storage);
    // Write-ahead rollback journal is recovered under the writer lock before play.
    storage.setItem(JOURNAL,JSON.stringify(before));
    try {
      for(const k of KEYS) data.records[k]===null?storage.removeItem(k):storage.setItem(k,data.records[k]);
      storage.removeItem(JOURNAL);
    } catch(error) {
      try {
        for(const k of KEYS) before.records[k]===null?storage.removeItem(k):storage.setItem(k,before.records[k]);
        storage.removeItem(JOURNAL);
      } catch(_) { throw Error('Restore interrupted. Close other tabs and reload to recover the retained rollback journal.'); }
      throw error;
    }
    return before;
  }
  function recover(storage) {
    const text=storage.getItem(JOURNAL); if(!text) return false;
    const old=validateBackup(text);
    for(const k of KEYS) old.records[k]===null?storage.removeItem(k):storage.setItem(k,old.records[k]);
    storage.removeItem(JOURNAL); return true;
  }
  function researchMetrics(completed=[]) {
    const done=new Set(completed);
    const introductory=['basicIndustry','miningRefining','constructionTechnology','electricity','urbanDevelopment','electronicsFoundations','industrialMachinery'];
    return {research:introductory.filter(id=>done.has(id)).length,
      advancedMetallurgy:done.has('advancedMetallurgy')?1:0,
      precisionFabrication:done.has('precisionFabrication')?1:0,
      industrialAutomation:done.has('industrialAutomation')?1:0};
  }
  function advance(saved, metrics) {
    const next={...saved,version:1,completed:[...new Set(saved?.completed||[])],pins:[...new Set(saved?.pins||[])].filter(id=>goals.some(g=>g.id===id)).slice(0,3),explored:[...new Set(saved?.explored||[])]};
    for(const g of goals) if(!next.completed.includes(g.id) && g.pre.every(id=>next.completed.includes(id)) && Number(metrics[g.metric]||0)>=g.target) next.completed.push(g.id);
    return next;
  }
  function pin(saved,id) {
    if(!goals.some(g=>g.id===id)) throw Error('Unknown goal.');
    const pins=[...(saved.pins||[])];
    const i=pins.indexOf(id); if(i>=0)pins.splice(i,1); else { if(pins.length>=3)throw Error('Unpin a goal before pinning another (maximum three).');pins.push(id); }
    return {...saved,pins};
  }
  function imageDimensions(input,mime) {
    const b=input instanceof Uint8Array?input:new Uint8Array(input),v=new DataView(b.buffer,b.byteOffset,b.byteLength);
    let w,h;
    if(mime==='image/png' && b.length>=24 && v.getUint32(0)===0x89504e47 && v.getUint32(4)===0x0d0a1a0a && v.getUint32(12)===0x49484452){w=v.getUint32(16);h=v.getUint32(20);}
    if(mime==='image/jpeg' && b[0]===255&&b[1]===216){
      let i=2;
      while(i+4<=b.length){if(b[i++]!==255)break;while(b[i]===255)i++;const marker=b[i++];if(marker===217||marker===218)break;if(marker===1||(marker>=208&&marker<=215))continue;if(i+2>b.length)break;const size=v.getUint16(i);if(size<2||i+size>b.length)break;
        if([192,193,194,195,197,198,199,201,202,203,205,206,207].includes(marker)&&size>=7){h=v.getUint16(i+3);w=v.getUint16(i+5);break;}i+=size;
      }
    }
    if(mime==='image/webp'&&b.length>=30&&v.getUint32(0)===0x52494646&&v.getUint32(8)===0x57454250){
      const kind=v.getUint32(12);
      if(kind===0x56503858){w=1+b[24]+(b[25]<<8)+(b[26]<<16);h=1+b[27]+(b[28]<<8)+(b[29]<<16);}
      if(kind===0x56503820&&b[23]===157&&b[24]===1&&b[25]===42){w=v.getUint16(26,true)&16383;h=v.getUint16(28,true)&16383;}
      if(kind===0x5650384c&&b[20]===47){w=1+(((b[22]&63)<<8)|b[21]);h=1+(((b[24]&15)<<10)|(b[23]<<2)|((b[22]&192)>>6));}
    }
    if(!Number.isInteger(w)||!Number.isInteger(h)||w<32||h<32||w>4096||h>4096)throw Error('Image must be a valid PNG, JPEG or WebP between 32 and 4096 pixels per side.');
    return {width:w,height:h};
  }
  function validateGoals() {
    const seen=new Set();
    for(const g of goals) { if(seen.has(g.id)||g.target<=0||g.pre.some(id=>!seen.has(id))) throw Error('Invalid advancement graph.'); seen.add(g.id); }
    return true;
  }
  const api={KEYS,JOURNAL,MAX_BYTES,goals,safeJSON,validateBackup,validateWorld,snapshot,restore,recover,advance,pin,validateGoals,imageDimensions,researchMetrics};
  if(typeof module!=='undefined')module.exports=api;
  else { root.mapGameFrontierModel=api; try {if(localStorage.getItem(JOURNAL))root.mapGameFrontierRecoveryError='An interrupted restore needs recovery before play.';} catch(e) {root.mapGameFrontierRecoveryError=e.message;} }
})(typeof window!=='undefined'?window:globalThis);
