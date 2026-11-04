// Original presentation assets only. Public third-party PNG mappings remain empty
// until their archive, visual meaning and redistribution rights are reviewed.
(function(root){
 'use strict';
 const escape=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const entries=Object.freeze([{id:'money',file:'assets/resource-icons/credit.svg',license:'CC0-1.0',source:'Original Map Game credit artwork'}]);
 function mapping(registry,rows){
  const map=new Map();
  for(const row of rows){
   if(!registry.material(row.id)||map.has(row.id)||row.license!=='CC0-1.0'||!row.source||!/^assets\/resource-icons\/[a-z0-9-]+\.png$/.test(row.file)&&!(row.id==='money'&&row.file==='assets/resource-icons/credit.svg'))throw Error('Unreviewed/invalid resource icon mapping');
   map.set(row.id,Object.freeze({...row}));
  }
  return map;
 }
 function image(map,id){const row=map.get(id);return row?`<img class="mg-resource-art" src="${escape(row.file)}" width="64" height="64" alt="" decoding="async">`:'';}
 const api={entries,mapping,image,escape};if(typeof module!=='undefined')module.exports=api;else root.mapGameResourceIcons=api;
})(globalThis);
