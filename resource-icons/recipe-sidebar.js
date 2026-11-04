// Read-only Easy Craft planner. Production is automatic under existing factory
// contracts; there is deliberately no manual crafting or resource-write API.
(function(root){
 'use strict';
 const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 function recipes(catalog){return catalog.filter(d=>d.economy&&Object.keys(d.economy.production||{}).some(k=>k!=='money'));}
 function inventory(s,id){return s[id]??s.inventory?.[id]??0;}
 function contracts(s,id){return (s.placedIncomeItems||[]).filter(r=>r.type===id).map(row=>({row,rule:s.economy?.rules?.[row.economyContract]}));}
 function status(sp,enabled,locked,count,statuses){
  if(!sp)return 'Central World crafting unavailable: server-authoritative crafting is not connected.';
  if(!enabled)return 'Singleplayer economy paused or settling.';
  if(count)return `${statuses.filter(x=>x.operating).length}/${count} factories operating. ${[...new Set(statuses.map(x=>x.reason))].join(' · ')}`;
  return locked||'Build a factory to start automatic production.';
 }
 const model={recipes,inventory,contracts,status};
 if(typeof module!=='undefined'){module.exports=model;return;}
 const E=root.mapGameEconomy,V=root.mapGameVisuals,R=root.mapGameIndustrialRegistry,P=root.mapGameProgression;
 const defs=recipes(root.mapGameBuildings.CATALOG),byId=new Map(defs.map(d=>[d.id,d]));let panel,button,selected=defs[0]?.id,last=null,signature='';
 const fmt=v=>Number(v||0).toLocaleString(undefined,{maximumFractionDigits:2});
 function hide(){if(panel){panel.hidden=true;button?.setAttribute('aria-expanded','false');button?.focus();}}
 function install(){
  const dock=document.getElementById('mgDock');if(button||!dock)return;
  button=document.createElement('button');button.id='mgEasyCraftButton';button.textContent='Easy Craft';button.title='Factory recipes and inventory';button.setAttribute('aria-expanded','false');button.setAttribute('aria-controls','mgEasyCraft');dock.append(button);
  button.onclick=()=>{if(panel&&!panel.hidden){hide();return;}ensure();panel.hidden=false;button.setAttribute('aria-expanded','true');signature='';render(last||E.snapshot());panel.querySelector('[data-recipe-close]').focus();};
 }
 function ensure(){
  if(panel)return;panel=document.createElement('aside');panel.id='mgEasyCraft';panel.hidden=true;panel.setAttribute('aria-label','Easy Craft factory planner');
  panel.innerHTML=`<header><div><small>PRODUCTION PLANNER</small><h2>Easy Craft</h2></div><button data-recipe-close aria-label="Close Easy Craft">×</button></header><p>Factories craft automatically. Browsing never spends resources.</p><label>Recipe<select data-recipe-choice>${defs.map(d=>`<option value="${esc(d.id)}">${esc(d.name)}</option>`).join('')}</select></label><div data-recipe-content></div>`;document.body.append(panel);
  panel.querySelector('[data-recipe-close]').onclick=hide;panel.querySelector('[data-recipe-choice]').onchange=e=>{selected=e.target.value;signature='';render(last||E.snapshot());};
  panel.addEventListener('keydown',e=>{if(e.key==='Escape'){e.preventDefault();e.stopPropagation();hide();}else if(e.key!=='Tab')e.stopPropagation();});
 }
 function amounts(values,s){return Object.entries(values||{}).map(([id,n])=>`<li>${V.icon(id)}<span>${esc(R.material(id)?.name||id)} <b>${fmt(n)}/min</b><small>Available: ${fmt(inventory(s,id))}</small></span></li>`).join('')||'<li>No material inputs</li>';}
 function render(s){
  if(!panel||panel.hidden)return;const d=byId.get(selected);if(!d)return;
  const sp=document.body.dataset.world==='singleplayer',owned=contracts(s,d.id),ids=new Set(owned.map(x=>x.row.id)),statuses=(s.summary?.buildings||[]).filter(x=>ids.has(x.id)),locked=P.reason(s,d),r=d.economy;
  // Detect actual pinned-contract variants; never claim the current catalog
  // recipe overwrites a previously purchased building's economics.
  const legacy=owned.filter(x=>x.rule&&JSON.stringify(x.rule)!==JSON.stringify(r));
  const key=JSON.stringify([selected,sp,s.enabled,locked,owned.length,statuses.map(x=>[x.reason,x.operating]),Object.keys({...r.inputs,...r.production}).map(id=>inventory(s,id)),legacy.map(x=>x.rule)]);
  if(signature===key)return;signature=key;
  const first=Object.keys(r.production||{})[0],area=panel.querySelector('[data-recipe-content]');
  area.innerHTML=`<div class="mg-recipe-hero">${V.icon(first)}<h3>${esc(d.name)}</h3></div><p>Catalog recipe · base/offline rates. Visible online throughput and inputs ×1.2; upkeep is unboosted.</p><h4>Required resources</h4><ul>${amounts(r.inputs,s)}</ul><h4>Output quantity</h4><ul>${amounts(r.production,s)}</ul><p>${fmt(r.energyUse)} power · ${fmt(r.workforce)} workers · $${fmt(r.upkeep)}/min upkeep</p><p data-recipe-status role="status">${esc(status(sp,s.enabled,locked,owned.length,statuses))}</p>${legacy.length?`<details><summary>Saved contracts retained (${legacy.length})</summary><p>These buildings keep their purchased rules; rates below are per level, before the existing online multiplier. No recipe is replaced.</p>${[...new Map(legacy.map(x=>[JSON.stringify(x.rule),x.rule])).values()].slice(0,10).map(rule=>`<h4>Saved inputs → outputs</h4><ul>${amounts(rule.inputs,s)}</ul><ul>${amounts(rule.production,s)}</ul>`).join('')}</details>`:''}<button disabled>Crafting is automatic at factories</button><button data-recipe-shop ${!sp?'disabled':''}>View construction</button>`;
  area.querySelector('[data-recipe-shop]').onclick=()=>{if(document.body.dataset.world!=='singleplayer')return;hide();root.mapGameEconomyUI.showShop();const shop=document.getElementById('mgEconomyShop');shop.querySelector('[data-category]').value='all';shop.querySelector('[data-availability]').value='all';const search=shop.querySelector('[data-search]');search.value=d.id;search.dispatchEvent(new Event('input',{bubbles:true}));};
 }
 // Reuse the economy's existing emitted snapshot. subscribe() eagerly clones
 // the entire city even while closed; an event listener avoids that extra boot copy.
 root.addEventListener('mapgame:economy',event=>{last=event.detail;install();render(last);});root.addEventListener('mapgame:runtime-ready',install);install();
 root.mapGameEasyCraft={hide,show:()=>{install();button?.click();},model};
})(globalThis);
