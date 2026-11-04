// Presentation only. No storage, timers, economy mutation or new goal definitions.
(function(root){
 'use strict';
 const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])),cache=new Map();
 const branchIcons={Civilization:'⌂',Industry:'⚒',Energy:'ϟ',Technology:'◈',Exploration:'⌖'};
 function goal(g,saved,metrics){const done=saved.completed?.includes(g.id),available=g.pre.every(id=>saved.completed?.includes(id)),value=Math.max(0,Math.min(g.target,Number.isFinite(metrics[g.metric])?Math.floor(metrics[g.metric]):0));return {state:done?'complete':!available?'locked':value>0?'in-progress':'available',value:done?g.target:value,tier:{Task:'Bronze',Milestone:'Silver',Legendary:'Gold'}[g.tier]||'Bronze',concealed:!!g.hidden&&!done&&!available,icon:branchIcons[g.branch]||'◇'};}
 function shopState(d,locked,enabled,active,affordable){if(locked)return {state:/Future|not purchasable|preserved internally/.test(locked)?'unavailable':'research',label:/Future|not purchasable|preserved internally/.test(locked)?'Unavailable':'Research locked'};if(!enabled)return{state:'paused',label:'Singleplayer only'};if(!active)return{state:'context',label:'Choose a territory'};return affordable?{state:'ready',label:'Ready to build'}:{state:'materials',label:'Materials needed'};}
 function preview(d){
  const key=d.id+':'+d.footprint.join('x');if(cache.has(key))return cache.get(key);
  const home=d.id==='smallHouse'||d.category==='Residential',energy=d.economy?.energySupply,commercial=d.category==='Commercial',sector=d.sector;
  const tone=home?'#e5c795':energy?'#e4c773':commercial?'#9bd8dd':sector==='chemicals'?'#bcc9bc':sector==='electronics'?'#b8c9e3':'#a8bfc8';
  const block=(x,y,w,h,depth)=>`<path d="M${x} ${y}l${w} -${w*.45} ${depth} ${depth*.45} -${w} ${w*.45}Z" fill="${tone}"/><path d="M${x} ${y}v${h}l${depth} ${depth*.45}v-${h}Z" fill="#385365"/><path d="M${x+depth} ${y+depth*.45}l${w} -${w*.45}v${h}l-${w} ${w*.45}Z" fill="#668899" stroke="#b7d2d422"/>`;
  let shapes=home?block(42,56,54,34,48)+`<path d="m38 56 29-36 30 9 51 24-26 16-48-22Z" fill="#365b6b" stroke="#9bb6ba"/><path d="m74 47 23-18 51 24-26 16Z" fill="#547c86"/><path d="m82 76 12-5v22l-12 5Z" fill="#e2ba72"/>`:energy?block(28,73,65,23,55)+`<path d="M110 64V22l20-9 17 8v44l-19 9Z" fill="#809a9a"/><path d="M130 13v45l17 7V21Z" fill="#455f70"/><path d="m63 63 10-15-2 12 10-4-15 20 3-14Z" fill="#ffdf83"/>`:commercial?block(42,40,62,59,42)+block(98,68,35,27,30):block(25,64,85,32,55)+`<path d="M46 63V24l10-4 10 5v35m21-14V13l9-4 9 5v28" fill="#8ca4ae" stroke="#d2d8c7"/><path d="m30 62 12-14 13 8 12-14 13 8 12-14 13 8 17 9" fill="none" stroke="#cfdbd5" stroke-width="5"/>`;
  if(!home)for(let i=0;i<5;i++)shapes+=`<path d="m${89+i*9} ${commercial?55+i*-4:76-i*4} 5-2v${commercial?24:10}l-5 2Z" fill="#b7e7df" opacity=".8"/>`;
  if(sector==='chemicals'||sector==='refining')shapes+='<ellipse cx="47" cy="87" rx="16" ry="7" fill="#afc2c2"/><path d="M31 87v21q16 13 32 0V87q-16 12-32 0Z" fill="#739b9b"/>';
  if(sector==='mining')shapes+='<path d="m40 109 24-19 19 8 15 16-30 12Z" fill="#77786b" stroke="#b4af90"/>';
  const svg=`<svg class="mg-building-preview premium-preview" viewBox="0 0 200 146" role="img" aria-label="${esc(d.name)} illustration, footprint ${esc(d.footprint.join(' by '))} metres"><path d="m12 103 92-42 84 38-91 44Z" fill="#071822"/><path d="m12 98 92-42 84 38-91 44Z" fill="#274550" stroke="#69a1ae55"/><path d="m20 100 80-37m-60 46 80-37m-60 46 80-37m-69 47 78-36" stroke="#5d849142"/>${shapes}<path d="m138 116 26-12" stroke="#e8c681" stroke-width="2"/><circle cx="170" cy="102" r="3" fill="${tone}"/></svg>`;
  cache.set(key,svg);return svg;
 }
 function settings(panel){
  const section=panel?.querySelector('[data-mf-studio]');if(!section)return;
  if(!section.dataset.premium){
   section.dataset.premium='true';panel.classList.add('premium-settings');panel.setAttribute('role','dialog');panel.setAttribute('aria-modal','true');panel.setAttribute('aria-label','Settings Studio');
   if(!document.getElementById('premiumSettingsBackdrop')){const shade=document.createElement('button');shade.id='premiumSettingsBackdrop';shade.type='button';shade.tabIndex=-1;shade.setAttribute('aria-label','Close settings');shade.onclick=()=>panel.querySelector('#mgCloseSettings').click();document.body.append(shade);}panel.querySelector('h2').textContent='Settings Studio';panel.querySelector('.mg-kicker').textContent='MAKE IT YOURS';
   const nav=document.createElement('nav');nav.className='premium-tabs';nav.setAttribute('role','tablist');nav.setAttribute('aria-label','Settings sections');
   const panes={};for(const [id,title,summary]of [['graphics','Graphics','Fast by default. Basic 2D keeps your frontier responsive.'],['audio','Audio','Quiet by default. Choose how your interface sounds.'],['interface','Interface','Your world, your way. Keep the essentials close.']]){
    const b=document.createElement('button');b.type='button';b.id='studio-tab-'+id;b.dataset.studioTab=id;b.setAttribute('role','tab');b.setAttribute('aria-controls','studio-'+id);b.textContent=title;nav.append(b);
    const pane=document.createElement('section');pane.id='studio-'+id;pane.dataset.studioPane=id;pane.setAttribute('role','tabpanel');pane.setAttribute('aria-labelledby',b.id);pane.innerHTML=`<h3>${title}</h3><p class="premium-section-lead">${summary}</p>`;panes[id]=pane;
   }
   const appearance=section.querySelector('#mf-appearance'),audio=section.querySelector('#mf-audio'),privateImages=[...section.querySelectorAll('details')].find(d=>d.querySelector('summary')?.textContent==='Private backgrounds'),graphics=[...section.querySelectorAll('details')].find(d=>d.querySelector('summary')?.textContent==='Gameplay & graphics');
   const advanced=document.createElement('details');advanced.className='premium-interface-advanced';advanced.innerHTML='<summary>Advanced appearance & private backgrounds</summary>';panes.interface.append(advanced);
   for(const key of ['theme','scale','motion'])panes.interface.insertBefore(appearance.querySelector(`[data-pref="${key}"]`).closest('label'),advanced);
   appearance.open=true;appearance.querySelector('summary').textContent='Fine-tune appearance';advanced.append(appearance);privateImages.id='mf-private-backgrounds';advanced.append(privateImages);
   const extras=document.createElement('div');extras.className='premium-studio-links';for(const selector of ['[data-worlds]','[data-account]','[data-reset-studio]']){const b=section.querySelector(selector);if(b)extras.append(b);}advanced.append(extras);
   audio.open=true;panes.audio.append(audio);for(const key of ['music','environment']){const input=audio.querySelector(`[data-pref="${key}"]`);input.disabled=true;input.closest('label').title='No audio tracks installed; saved preference retained';}
   graphics.querySelector('summary').textContent='Advanced · paused Regular renderer';graphics.open=false;panes.graphics.append(graphics);
   for(const node of [...section.children])if(!Object.values(panes).includes(node))node.remove();section.append(nav,...Object.values(panes));
   const activate=id=>{for(const b of nav.children){const yes=b.dataset.studioTab===id;b.setAttribute('aria-selected',String(yes));b.tabIndex=yes?0:-1;}for(const [key,pane]of Object.entries(panes))pane.hidden=key!==id;};
   for(const b of nav.children)b.onclick=()=>activate(b.dataset.studioTab);
   nav.onkeydown=e=>{const tabs=[...nav.children],i=tabs.indexOf(document.activeElement);if(i<0)return;let n;if(e.key==='ArrowRight')n=(i+1)%3;if(e.key==='ArrowLeft')n=(i+2)%3;if(e.key==='Home')n=0;if(e.key==='End')n=2;if(n!==undefined){e.preventDefault();tabs[n].click();tabs[n].focus();}};
   activate('graphics');
  }
  // Live legacy controls move, never clone; all their storage/listeners survive.
  const g=section.querySelector('[data-studio-pane="graphics"]'),i=section.querySelector('[data-studio-pane="interface"]'),advanced=g.querySelector('details');
  for(const group of [...panel.children].filter(n=>n.classList.contains('mg-settings-group'))){
   if(group.classList.contains('mg-appearance-settings')){const density=group.querySelector('[data-visual-density]')?.closest('label');if(density)i.insertBefore(density,i.querySelector('details'));group.querySelector('h3').textContent='Legacy palette & HUD';i.querySelector('details').append(group);}
   else if(group.querySelector('[data-setting="graphics"]'))g.insertBefore(group,advanced);
   else{let field=advanced.querySelector('fieldset');if(!field){field=document.createElement('fieldset');field.disabled=true;field.innerHTML='<legend>Regular-only controls · inactive in Basic</legend>';advanced.append(field);}field.append(group);}
  }
  const toggle=panel.querySelector('#mgGraphicsToggle');if(toggle){toggle.disabled=true;toggle.title='Regular 3D remains paused';advanced.append(toggle);}
 }
 const api={goal,shopState,preview,settings,branchIcons};if(typeof module!=='undefined')module.exports=api;else root.mapGamePremium=api;
})(globalThis);
