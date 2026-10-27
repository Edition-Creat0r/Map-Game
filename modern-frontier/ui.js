// Modern Frontier presentation, private SP backups and cosmetic advancements.
(() => {
  'use strict';
  const F=window.mapGameFrontierModel,E=window.mapGameEconomy,V=window.mapGameVisuals;
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const PREF='mapgame_frontier_preferences_v1', WORLD=F.KEYS[3], FAVORITES='mapgame_frontier_favorites_v1';
  let prefs={version:1,theme:'frontier',accent:'#6be2de',background:'#07131f',scale:100,motion:'subtle',scene:'landscape',master:0.5,ui:0.35,music:0,environment:0,mute:true,lineGlow:0.45,lineSpeed:4,homeX:50,homeY:50,graphX:50,graphY:50,homeDim:55,graphDim:75,imageZoom:100,shop:'illustrated',graph:'evolving'};
  try {const v=JSON.parse(localStorage.getItem(PREF)||'null');if(v?.version===1)prefs={...prefs,...v};}catch(_){}
  let dialog,returnFocus,world,lastSignature='',lastRows=null,lastResearch=null,metrics={},graph={x:20,y:20,zoom:1},graphDrag,context,lastTone=0,homeBackup=null;
  let latest=E.snapshot(),worldError='',restoreError=window.mapGameFrontierRecoveryError||'';
  const number=n=>Number(n||0).toLocaleString(undefined,{maximumFractionDigits:0});
  const reduced=()=>matchMedia('(prefers-reduced-motion: reduce)').matches || prefs.motion==='off';
  function apply(){
    const root=document.documentElement;
    root.dataset.frontierTheme=['frontier','midnight','forest','gold','violet'].includes(prefs.theme)?prefs.theme:'frontier';
    root.dataset.frontierMotion=reduced()?'off':prefs.motion;
    root.dataset.homeScene=['landscape','industrial','static'].includes(prefs.scene)?prefs.scene:'landscape';
    for(const [k,key] of [['--mf-accent','accent'],['--mf-background','background']]) if(/^#[a-f\d]{6}$/i.test(prefs[key]))root.style.setProperty(k,prefs[key]);
    root.style.setProperty('--mf-scale',Math.max(90,Math.min(125,Number(prefs.scale)||100))/100);
    root.style.setProperty('--mf-glow',Math.max(0,Math.min(1,Number(prefs.lineGlow)||0)));
    root.style.setProperty('--mf-speed',Math.max(1,Math.min(12,Number(prefs.lineSpeed)||4))+'s');
    root.dataset.shopAppearance=prefs.shop==='compact'?'compact':'illustrated';
    root.dataset.graphAppearance=prefs.graph==='simple'?'simple':'evolving';
    for(const key of ['home','graph']){
      root.style.setProperty(`--mf-${key}-position`,`${Math.max(0,Math.min(100,Number(prefs[key+'X'])||0))}% ${Math.max(0,Math.min(100,Number(prefs[key+'Y'])||0))}%`);
      root.style.setProperty(`--mf-${key}-dim`,Math.max(20,Math.min(90,Number(prefs[key+'Dim'])||60))/100);
    }
    root.style.setProperty('--mf-image-zoom',Math.max(100,Math.min(200,Number(prefs.imageZoom)||100))+'%');
  }
  function savePrefs(){apply();try{localStorage.setItem(PREF,JSON.stringify(prefs));}catch(_){V.announce('Settings apply this session; device storage is full.');}}
  apply();
  matchMedia('(prefers-reduced-motion: reduce)').addEventListener('change',apply);
  function tone(kind='select'){
    if(prefs.mute||!Number(prefs.master)||!Number(prefs.ui)||reduced()||performance.now()-lastTone<85)return;
    lastTone=performance.now();
    try {
      context ||= new (window.AudioContext||window.webkitAudioContext)();
      if(context.state==='suspended')context.resume().catch(()=>{});
      const o=context.createOscillator(),g=context.createGain(),now=context.currentTime;
      o.type='sine';o.frequency.setValueAtTime({open:330,close:250,select:440,success:660,invalid:150,unlock:880}[kind]||440,now);
      o.frequency.exponentialRampToValueAtTime(kind==='invalid'?110:550,now+0.09);
      g.gain.setValueAtTime(Math.min(0.12,Number(prefs.master)*Number(prefs.ui)*0.12),now);g.gain.exponentialRampToValueAtTime(0.0001,now+0.13);
      o.connect(g).connect(context.destination);o.start(now);o.stop(now+0.14);
    }catch(_){}
  }
  // Only an actual user gesture can start/resume audio. Boot/hover are silent.
  document.addEventListener('click',e=>{if(e.isTrusted&&e.target.closest('button,summary,select'))tone(e.target.closest('[disabled]')?'invalid':'select');});
  function close(){if(dialog){dialog.hidden=true;dialog.dataset.view='';dialog.replaceChildren();}returnFocus?.isConnected&&returnFocus.focus();tone('close');}
  function show(title,body){
    E.getStatus();
    if(dialog)dialog.dataset.view='';
    if(!dialog){dialog=document.createElement('section');dialog.id='mfDialog';dialog.className='mf-dialog';dialog.hidden=true;dialog.setAttribute('role','dialog');dialog.setAttribute('aria-modal','true');document.body.append(dialog);V.trapDialog(dialog);dialog.addEventListener('keydown',e=>{if(e.key==='Escape'){e.preventDefault();e.stopImmediatePropagation();close();}});}
    if(dialog.hidden)returnFocus=document.activeElement;
    window.mapGameEconomyUI.hideShop();
    for(const id of ['mgProgressionPanel','mgEconomyStats','mgSettingsPanel']){const el=document.getElementById(id);if(el)el.hidden=true;}
    dialog.setAttribute('aria-label',title);dialog.innerHTML=`<div class="mf-dialog-shell"><header><div><small>MAP GAME / MODERN FRONTIER</small><h2>${esc(title)}</h2></div><button data-mf-close aria-label="Close ${esc(title)}">Close ×</button></header><div class="mf-dialog-body">${body}</div></div>`;dialog.hidden=false;dialog.querySelector('[data-mf-close]').onclick=close;dialog.querySelector('[data-mf-close]').focus();tone('open');return dialog;
  }
  function download(value,name){const b=new Blob([JSON.stringify(value,null,2)],{type:'application/json'}),url=URL.createObjectURL(b),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
  function persistedSummary(){
    try{const raw=F.safeJSON(localStorage.getItem(F.KEYS[0])||'{}'),w=F.safeJSON(localStorage.getItem(F.KEYS[1])||'{}');return {raw,w,exists:localStorage.getItem(F.KEYS[0])!==null||localStorage.getItem(F.KEYS[1])!==null};}catch(e){return {error:e.message,exists:true};}
  }
  function home(){
    const root=document.getElementById('mgHome');if(!root)return;
    root.classList.add('mf-home');
    document.getElementById('mgOpenSettings')?.addEventListener('click',()=>V.settings());
    const hero=root.querySelector('.mg-home-hero');
    hero.querySelector('.mg-home-kicker').textContent='MAP GAME / MODERN FRONTIER';
    hero.querySelector('h1').innerHTML='Modern<br><span>Frontier.</span>';
    hero.querySelector('p').textContent='Find your frontier. Shape a city. Connect an industrial world.';
    root.querySelector('.mg-home-feature-row').innerHTML='<span>EXPLORE</span><span>BUILD</span><span>INNOVATE</span>';
    const scene=document.createElement('div');scene.className='mf-scene';scene.setAttribute('aria-hidden','true');
    scene.innerHTML=`<svg viewBox="0 0 1440 900" preserveAspectRatio="xMidYMid slice"><path fill="#162d3c" d="M0 330L190 110 340 300 545 70 730 310 920 160 1150 340 1440 180V900H0Z"/><path fill="#34505b" d="M190 110l-48 90 48-19 48 23zM545 70l-70 115 63-29 48 25 48-1zM920 160l-43 70 46-16 35 23z"/><path fill="#274746" d="M0 520Q260 280 510 490T980 480T1440 430V900H0Z"/><path fill="#31594f" d="M0 670Q260 450 540 590T1050 560T1440 590V900H0Z"/><path fill="#4d8991" opacity=".6" d="M900 460Q680 530 850 590T620 730T690 900H880Q700 750 870 690T930 570T950 460Z"/><path fill="#4b5b5b" d="M0 790L1000 710 1440 780V804L1000 737 0 821Z"/><g fill="#71898a" stroke="#1a323d" stroke-width="3"><path d="M1000 685V602L1040 579 1080 600V690Z"/><path d="M1090 700V630H1180V710Z"/><path d="M1160 630V580H1175V630Z"/><path d="M1220 717V608L1260 591 1295 610V732Z"/></g><g fill="#efcb8b"><path d="M1015 613h9v15h-9zm20 0h9v15h-9zm20 0h9v15h-9zm-40 30h9v15h-9zm20 0h9v15h-9zm20 0h9v15h-9z"/><path d="M1234 628h10v17h-10zm24 0h10v17h-10zm-24 30h10v17h-10zm24 0h10v17h-10z"/></g><g class="mf-cloud" fill="#b4ccd3" opacity=".10"><ellipse cx="750" cy="220" rx="150" ry="15"/><ellipse cx="1090" cy="125" rx="120" ry="12"/></g></svg><img class="mf-scene-tree tree-a" src="assets/environment/trees/tree_small_green.png" alt=""><img class="mf-scene-tree tree-b" src="assets/environment/trees/tree_round_olive.png" alt=""><img class="mf-scene-tree tree-c" src="assets/environment/trees/tree_small_teal.png" alt="">`;
    root.prepend(scene);
    const cards=root.querySelector('.mg-home-cards'),single=root.querySelector('#mgStartSingle').closest('article'),central=root.querySelector('#mgJoinCentral').closest('article');cards.prepend(single);single.classList.add('mg-world-card-primary');central.classList.remove('mg-world-card-primary');
    single.querySelector('.mg-card-badge').textContent='YOUR WORLD';single.querySelector('p').textContent='Explore biomes, build a civilization and keep production moving while you are away.';
    central.querySelector('p').textContent='Enter the shared world. An authenticated, verified account is required. Multiplayer industry is not yet available.';
    const info=persistedSummary(),btn=single.querySelector('#mgStartSingle');
    // createHome updates this label when binding; set it again after boot-ready.
    function label(){if(btn.isConnected)btn.textContent=info.exists?'CONTINUE WORLD':'START SINGLEPLAYER';}
    label();window.addEventListener('mapgame:boot-ready',label,{once:true});
    const tools=document.createElement('div');tools.className='mf-home-world-tools';tools.innerHTML='<button data-world-info>World details & backups</button><button data-new-world>New World</button>';single.append(tools);tools.querySelector('[data-world-info]').onclick=()=>worldManager();tools.querySelector('[data-new-world]').onclick=()=>worldManager(true);
    const progress=document.createElement('p');progress.className='mf-world-summary';progress.textContent=info.error?'Saved world needs attention. Open World details.':info.exists?`${number(info.raw?.placedIncomeItems?.length)} buildings · ${window.mapGameProgression.eras[(info.raw?.economy?.progression?.era||1)-1]} · ${number(info.raw?.economy?.progression?.completed?.length)} technologies · ${(() => {try{return F.safeJSON(localStorage.getItem(WORLD)||'{}').progress?.completed?.length||0;}catch(_){return 0;}})()} advancements`:'A fresh frontier · 316 × 316 territories';single.append(progress);
    const extra=document.createElement('section');extra.className='mf-home-secondary';extra.innerHTML=`<div class="mf-showcase"><span><b>BUILD</b> Cities & industry <small>Playable · Singleplayer</small></span><span><b>DISCOVER</b> Biomes & waterways <small>Playable</small></span><span><b>INNOVATE</b> Manufacturing & research <small>Playable · Singleplayer</small></span><span><b>COMMAND</b> Future equipment <small>Planned · no combat</small></span><span><b>CHALLENGE</b> Friends & minigames <small>Planned</small></span><span><b>CONNECT</b> Central World <small>Existing authenticated world</small></span></div><div class="mf-home-bottom"><section><h3>Developer’s Corner</h3><div data-updates>Development notes loading…</div></section><section><h3>Friends & community</h3><p>Friends, private messages and additional servers are planned. No private messaging service is connected.</p><button data-account>Account & privacy</button> <button disabled title="Additional servers are not implemented">Servers · Planned</button><p class="mf-fine">Internet is required to load external game libraries. Offline launch is not verified.</p></section></div>`;root.querySelector('main').append(extra);extra.querySelector('[data-account]').onclick=account;
    fetch('modern-frontier/updates.json').then(r=>{if(!r.ok)throw Error();return r.json();}).then(v=>{extra.querySelector('[data-updates]').innerHTML=v.entries.map(n=>`<details><summary>${esc(n.title)} <small>${esc(n.status)}</small></summary><p>${esc(n.detail)}</p></details>`).join('');}).catch(()=>{extra.querySelector('[data-updates]').textContent='Development notes are unavailable; gameplay can still start.';});
  }
  async function account(){
    const el=show('Account & community','<p data-account-status>Checking account…</p><div class="mf-empty-grid"><section><h3>Friends & messages</h3><p>Planned. Private communication remains disabled until privacy controls, authorization, blocking, reporting and moderation are verified.</p><button disabled>Messages · Unavailable</button></section><section><h3>Username</h3><p>Server-enforced unique names and the two-hour rename cooldown are not yet deployed.</p><button disabled>Change username · Unavailable</button></section><section><h3>Account deletion</h3><p>Unavailable pending a reviewed server deletion and retention policy. No account data is deleted by this interface.</p><button disabled>Delete account · Unavailable</button></section></div>');
    try{const u=await window.mapGameAuth?.getCurrentUser();if(el.hidden||!el.querySelector('[data-account-status]'))return;el.querySelector('[data-account-status]').textContent=u?`Signed in as ${u.user_metadata?.username||u.email||'Player'}. ${window.mapGameAuth.isVerified(u)?'Email verified.':'Email verification required.'}`:'Not signed in. Use Enter Central World on the home screen to sign in or create an account.';}catch(_){el.querySelector('[data-account-status]').textContent='Account service unavailable.';}
  }
  async function exclusive(fn){
    if(!navigator.locks)throw Error('A secure origin and Web Locks are required.');
    if(window.mapGameRuntime?.getMode()!=='HOME')throw Error('Import or reset is allowed only on the home screen. Export first, then reload to Home.');
    return navigator.locks.request('mapgame-singleplayer-economy-writer',{ifAvailable:true},async lock=>{if(!lock)throw Error('Close the other Singleplayer tab before changing this world.');return fn();});
  }
  function validateSemantics(data){
    const text=data.records[F.KEYS[0]];
    if(text){const raw=F.safeJSON(text);window.mapGameEconomyModel.normalize(raw,Date.now());}
    return data;
  }
  async function exportWorld(){
    if(E.getStatus().catchingUp)throw Error('Wait for offline production to finish before exporting.');
    if(document.body.dataset.world==='central')throw Error('This manager exports Singleplayer only. Reload to Home to manage its save.');
    const active=E.getStatus().enabled;
    if(active&&!E.save())throw Error('Could not save the economy.');
    // Stop own writer, then acquire the SAME lock, so a different tab cannot race the snapshot.
    if(active)E.setEnabled(false);
    try{return await navigator.locks.request('mapgame-singleplayer-economy-writer',{ifAvailable:true},lock=>{if(!lock)throw Error('Another tab is writing this world. Close it first.');return F.snapshot(localStorage);});}
    finally{if(active)E.setEnabled(true);}
  }
  function worldManager(newWorld=false){
    const info=persistedSummary(),atHome=window.mapGameRuntime?.getMode()==='HOME';homeBackup=null;
    const el=show('Worlds & backups',`<div class="mf-world-overview"><div><small>SINGLEPLAYER · LOCAL TO THIS BROWSER</small><h3>${info.exists?'Your frontier':'A new frontier awaits'}</h3><p>World engine ${esc(window.mapGameWorldConfig.VERSION)} · economy schema ${esc(info.raw?.economy?.version??'legacy / new')} · seed ${esc(localStorage.getItem(F.KEYS[2])||734221)}</p><p>${number(info.raw?.placedIncomeItems?.length)} buildings · ${number(info.w?.claims?.length)} saved claims</p><p>Save status: ${esc(info.error||E.getStatus().error||'Origin-local records available')}. Backups include exact ledgers, contracts, claims, unknown fields, seed and advancements. Authentication tokens and private backgrounds are excluded.</p></div></div><div class="mf-backup-actions"><button data-export>Export World backup</button><label class="mf-file">Import compatible backup<input type="file" accept="application/json,.json" data-import ${!atHome?'disabled':''}></label><button data-restore ${!atHome||!localStorage.getItem('mapgame_frontier_preimport_v1')?'disabled':''}>Restore pre-change backup</button></div><p>${atHome?'Import and New World require deliberate confirmation and retain a private recovery snapshot.':'Import/reset require returning to Home: export, then reload this page. Current gameplay is preserved.'}</p><div data-backup-message role="status">${esc(restoreError)}</div><div data-import-confirm></div><details ${newWorld?'open':''}><summary>New World · replaces the current local slot</summary><p>Export your current world first. There is one active local slot. No multiplayer data is changed.</p><button data-prepare-new ${!atHome?'disabled':''}>Prepare New World</button><div data-new-confirm></div></details><p class="mf-fine">No downgrade by editing schema numbers. Restore only a full compatible snapshot. Backups may contain personal world data: keep them private.</p>`);
    const msg=t=>el.querySelector('[data-backup-message]').textContent=t;
    el.querySelector('[data-export]').onclick=async()=>{try{homeBackup=await exportWorld();download(homeBackup,'mapgame-world-backup.json');msg('Backup exported. Keep this file somewhere safe.');}catch(e){msg(e.message);}};
    function confirmation(data,title){
      validateSemantics(F.validateBackup(JSON.stringify(data)));const area=el.querySelector('[data-import-confirm]');area.innerHTML=`<h3>${esc(title)}</h3><p>This replaces the Singleplayer slot, then reloads Home. A pre-change recovery snapshot is retained. Type RESTORE to confirm.</p><input data-confirm-word aria-label="Type RESTORE to replace the world"><button data-confirm-restore>Confirm replacement</button><button data-cancel-restore>Cancel</button>`;
      area.querySelector('[data-cancel-restore]').onclick=()=>area.replaceChildren();
      area.querySelector('[data-confirm-restore]').onclick=async()=>{if(area.querySelector('input').value!=='RESTORE'){msg('Type RESTORE exactly to confirm.');return;}try{await exclusive(()=>{const old=F.snapshot(localStorage);localStorage.setItem('mapgame_frontier_preimport_v1',JSON.stringify(old));F.restore(localStorage,data);});location.reload();}catch(e){msg(e.message);}};
    }
    el.querySelector('[data-import]').onchange=async e=>{try{const file=e.target.files[0];if(!file)return;if(file.size>F.MAX_BYTES)throw Error('Backup exceeds 32 MB.');const data=F.validateBackup(await file.text());confirmation(data,'Import preview');msg('Backup validated. Nothing has changed yet.');}catch(e){msg(e.message);}};
    el.querySelector('[data-restore]').onclick=()=>{try{confirmation(F.validateBackup(localStorage.getItem('mapgame_frontier_preimport_v1')),'Restore recovery snapshot');}catch(e){msg(e.message);}};
    el.querySelector('[data-prepare-new]').onclick=()=>{
      if(!homeBackup){msg('Export World backup before preparing a new world.');return;}
      const area=el.querySelector('[data-new-confirm]');area.innerHTML='<label>World seed <input data-new-seed type="number" min="1" max="2147483647" value="734221"></label><label>Type NEW WORLD to replace the local slot <input data-new-word></label><button data-create-new>Create New World</button>';
      area.querySelector('[data-create-new]').onclick=async()=>{try{if(area.querySelector('[data-new-word]').value!=='NEW WORLD')throw Error('Type NEW WORLD exactly.');const seed=Number(area.querySelector('[data-new-seed]').value);if(!Number.isInteger(seed)||seed<1||seed>2147483647)throw Error('Use a whole seed between 1 and 2147483647.');await exclusive(()=>{const old=F.snapshot(localStorage);if(JSON.stringify(old.records)!==JSON.stringify(homeBackup.records))throw Error('World changed since export. Export a fresh backup.');localStorage.setItem('mapgame_frontier_preimport_v1',JSON.stringify(old));const empty=F.snapshot({getItem:()=>null});empty.records[F.KEYS[2]]=String(seed);F.restore(localStorage,empty);});location.reload();}catch(e){msg(e.message);}};
    };
  }
  function loadWorld(){
    if(world)return;
    try{const raw=localStorage.getItem(WORLD);world=raw?F.validateWorld(F.safeJSON(raw)):{version:1,worldId:crypto.randomUUID(),seed:window.mapGameSharedTerrain.seed,progress:{version:1,completed:[],pins:[],explored:[]}};
      if(world.seed!==window.mapGameSharedTerrain.seed)throw Error('Advancements belong to a different world seed. Import a matching complete backup.');
    }catch(e){worldError=e.message;world=null;}
  }
  function persistProgress(){try{localStorage.setItem(WORLD,JSON.stringify(world));return true;}catch(_){worldError='Advancements could not be saved. Free device storage before continuing.';return false;}}
  function update(s){
    latest=s;
    if(!s.enabled||document.body.dataset.world!=='singleplayer')return;
    loadWorld();if(!world)return;
    // Reuse existing snapshot. No simulation/noise/per-pixel work; rows scanned only when their identity changes.
    const rows=s.placedIncomeItems||[],completed=s.economy.progression?.completed||[];
    const active=window.mapGameBasicWorld?.getState(),territory=active?.active?active.territory?.id:null;
    const rowSignature=rows.length+':'+(rows.at(-1)?.id||'');
    if(lastRows!==rowSignature){
      metrics={...metrics,homes:0,power:0,steelFactories:0,carbonFactories:0,commercial:0,industrial:0};
      const industrial=new Set(window.mapGameIndustrialRegistry.data.buildings.map(b=>b.id));
      for(const r of rows){if(r.type==='smallHouse')metrics.homes++;if(r.type==='powerPlant')metrics.power++;if(r.type==='steelMill')metrics.steelFactories++;if(r.type==='carbonPlant')metrics.carbonFactories++;if(r.type==='cornerStore')metrics.commercial++;if(industrial.has(r.type))metrics.industrial++;}
      if(lastRows!==null&&context?.state==='running')tone('success');lastRows=rowSignature;
    }
    const before=JSON.stringify(world.progress);
    if(territory&&!world.progress.explored?.includes(territory))world.progress.explored=[...(world.progress.explored||[]),territory];
    metrics.population=s.summary.population;metrics.research=completed.length;metrics.territories=world.progress.explored?.length||0;
    const old=world.progress.completed||[];world.progress=F.advance(world.progress,metrics);
    if(JSON.stringify(world.progress)!==before){persistProgress();const added=world.progress.completed.filter(id=>!old.includes(id));if(added.length){advancementNotice(`Advancement: ${F.goals.find(g=>g.id===added[0]).name}`);if(context?.state==='running')tone('unlock');}}
    lastResearch=completed.length;
    renderPins();
    if(dialog&&!dialog.hidden&&dialog.dataset.view==='advancements')renderGraph();
  }
  let noticeTimer;
  function advancementNotice(text){
    let el=document.getElementById('mfAdvancementNotice');if(!el){el=document.createElement('div');el.id='mfAdvancementNotice';el.setAttribute('role','status');document.body.append(el);}
    el.textContent=text;el.hidden=false;clearTimeout(noticeTimer);noticeTimer=setTimeout(()=>el.hidden=true,3500);
  }
  function renderPins(){
    let el=document.getElementById('mfPinned');if(!el){el=document.createElement('aside');el.id='mfPinned';el.setAttribute('aria-label','Pinned goals');document.body.append(el);}
    el.hidden=document.body.dataset.world!=='singleplayer'||!world?.progress?.pins?.length;
    const html=(world?.progress?.pins||[]).map(id=>{const g=F.goals.find(g=>g.id===id);return `<button data-pin-open>${esc(g.name)} <small>${world.progress.completed.includes(id)?'Complete':`${Math.min(g.target,metrics[g.metric]||0)} / ${g.target}`}</small></button>`;}).join('');
    if(el.dataset.content!==html){el.dataset.content=html;el.innerHTML=html;el.querySelectorAll('button').forEach(b=>b.onclick=advancements);}
  }
  function advancements(){
    if(document.body.dataset.world!=='singleplayer'){show('Advancements','<p>Singleplayer advancements are available after entering your world. Multiplayer progress and rewards remain unavailable until verified server events exist.</p>');return;}
    loadWorld();if(!world){show('Advancements',`<p>${esc(worldError)}</p>`);return;}
    const el=show('The evolving frontier',`<div class="mf-graph-toolbar"><p>Advancements celebrate what you build. Research unlocks capabilities. Rewards here are cosmetic recognition only.</p><button data-zoom-out aria-label="Zoom advancement graph out">−</button><button data-zoom-in aria-label="Zoom advancement graph in">+</button><button data-reset-view>Reset view</button><button data-open-research>Open research</button></div><div class="mf-graph" tabindex="0" aria-label="Advancement graph. Drag to pan, plus or minus to zoom, arrows to pan."><div class="mf-graph-world"></div></div><p data-goal-message role="status">${esc(worldError)} Pin up to three goals. Exploration begins with visits made after this update.</p><div class="mf-future-branches">Military · Minigames · Community <span>Planned · no objectives or rewards active</span></div>`);
    el.dataset.view='advancements';lastSignature='';renderGraph();const stage=el.querySelector('.mf-graph');
    function transform(){const node=stage.querySelector('.mf-graph-world');node.style.transform=`translate(${graph.x}px,${graph.y}px) scale(${graph.zoom})`;}
    const zoom=f=>{graph.zoom=Math.max(0.45,Math.min(1.7,graph.zoom*f));transform();};
    el.querySelector('[data-zoom-out]').onclick=()=>zoom(1/1.15);el.querySelector('[data-zoom-in]').onclick=()=>zoom(1.15);el.querySelector('[data-reset-view]').onclick=()=>{graph={x:20,y:20,zoom:1};transform();};
    el.querySelector('[data-open-research]').onclick=()=>{close();window.mapGameProgressionUI.showResearch();};
    stage.addEventListener('wheel',e=>{e.preventDefault();zoom(e.deltaY>0?1/1.08:1.08);},{passive:false});
    stage.addEventListener('pointerdown',e=>{if(e.target.closest('button'))return;graphDrag={x:e.clientX,y:e.clientY,gx:graph.x,gy:graph.y};stage.setPointerCapture(e.pointerId);});
    stage.addEventListener('pointermove',e=>{if(!graphDrag)return;graph.x=Math.max(-1500,Math.min(1000,graphDrag.gx+e.clientX-graphDrag.x));graph.y=Math.max(-900,Math.min(700,graphDrag.gy+e.clientY-graphDrag.y));transform();});
    for(const type of ['pointerup','pointercancel'])stage.addEventListener(type,()=>graphDrag=null);
    stage.addEventListener('keydown',e=>{if(e.target!==stage)return;if(['+','=','-','ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key)){e.preventDefault();if(e.key==='-'||e.key==='+'||e.key==='=')zoom(e.key==='-'?1/1.15:1.15);else{graph.x+=e.key==='ArrowLeft'?35:e.key==='ArrowRight'?-35:0;graph.y+=e.key==='ArrowUp'?35:e.key==='ArrowDown'?-35:0;transform();}}});
    transform();
  }
  function renderGraph(){
    const el=dialog?.querySelector('.mf-graph-world');if(!el)return;
    const p=world.progress,signature=JSON.stringify([p.completed,p.pins,metrics,prefs.graph]);if(signature===lastSignature)return;lastSignature=signature;
    const focused=document.activeElement?.dataset.pin;
    const branches=['Civilization','Energy','Industry','Exploration','Technology'],positions={},counts={};
    for(const g of F.goals){const col=branches.indexOf(g.branch),row=counts[g.branch]||0;counts[g.branch]=row+1;positions[g.id]={x:col*255,y:60+row*160};}
    const visible=F.goals.filter(g=>p.completed.includes(g.id)||g.pre.every(id=>p.completed.includes(id)));
    const visibleIds=new Set(visible.map(g=>g.id));
    const lines=visible.flatMap(g=>g.pre.filter(id=>visibleIds.has(id)).map(id=>{const a=positions[id],b=positions[g.id];return `<path class="${p.completed.includes(id)?'complete':''}" d="M${a.x+112} ${a.y+130} C${a.x+112} ${a.y+155},${b.x+112} ${b.y-20},${b.x+112} ${b.y}"/>`;})).join('');
    el.innerHTML=`<svg viewBox="0 0 1290 780" aria-hidden="true">${lines}</svg>${branches.map((b,i)=>`<h3 class="mf-branch-label" style="left:${i*255}px">${b}</h3>`).join('')}${visible.map(g=>{const done=p.completed.includes(g.id),available=g.pre.every(id=>p.completed.includes(id)),pos=positions[g.id];return `<article class="mf-goal ${done?'complete':available?'available':'locked'} ${g.tier.toLowerCase()}" style="left:${pos.x}px;top:${pos.y}px" data-goal-id="${g.id}"><small>${g.tier} / ${done?'Completed':available?'Available':'Locked'}</small><h3>${esc(g.name)}</h3><p>${esc(g.text)}</p><span>${done?'✓ Recognized':`${Math.min(g.target,metrics[g.metric]||0)} / ${g.target}`}</span><button data-pin="${g.id}" aria-pressed="${p.pins.includes(g.id)}">${p.pins.includes(g.id)?'Unpin':'Pin goal'}</button><details><summary>Prerequisites & reward</summary><p>${g.pre.length?g.pre.map(id=>esc(F.goals.find(x=>x.id===id).name)).join(', '):'No prerequisites'}. Reward: permanent recognition. No currency or resource reward.</p></details></article>`;}).join('')}`;
    el.dataset.complexity=p.completed.length>8?'mastery':p.completed.length>3?'expansion':'foundations';
    el.querySelectorAll('[data-pin]').forEach(b=>b.onclick=()=>{try{world.progress=F.pin(world.progress,b.dataset.pin);persistProgress();renderGraph();renderPins();}catch(e){dialog.querySelector('[data-goal-message]').textContent=e.message;}});
    if(focused)el.querySelector(`[data-pin="${focused}"]`)?.focus();
  }
  async function imageDB(){return new Promise((resolve,reject)=>{const r=indexedDB.open('mapgame_frontier_private_images',1);r.onupgradeneeded=()=>r.result.createObjectStore('images');r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(Error('Private image storage unavailable.'));});}
  const urls={};
  async function background(key,blob,read=false){
    const db=await imageDB();try{await new Promise((resolve,reject)=>{const tx=db.transaction('images',read?'readonly':'readwrite'),store=tx.objectStore('images'),r=read?store.get(key):blob?store.put(blob,key):store.delete(key);let value; r.onsuccess=()=>{value=r.result;};tx.oncomplete=()=>{if(read)blob=value;resolve();};tx.onerror=()=>reject(Error('Private image storage is full or unavailable.'));tx.onabort=()=>reject(Error('Private image could not be saved.'));});}finally{db.close();}
    if(urls[key])URL.revokeObjectURL(urls[key]);delete urls[key];if(blob)urls[key]=URL.createObjectURL(blob);
    document.documentElement.style.setProperty(`--mf-${key}-image`,blob?`url("${urls[key]}")`:'none');
  }
  function studio(){
    const panel=document.getElementById('mgSettingsPanel');if(!panel||panel.querySelector('[data-mf-studio]'))return;
    const section=document.createElement('section');section.dataset.mfStudio='';section.className='mf-studio';
    section.innerHTML=`<h3>Modern Frontier studio</h3><nav class="mf-settings-nav" aria-label="Settings sections"><button data-jump="appearance">Appearance</button><button data-jump="audio">Audio</button><button data-worlds>Worlds & backups</button><button data-account>Account</button></nav><details open id="mf-appearance"><summary>Appearance</summary><label>Preset<select data-pref="theme"><option value="frontier">Modern Frontier</option><option value="midnight">Midnight Command</option><option value="forest">Forest Technology</option><option value="gold">Industrial Gold</option><option value="violet">Neon Violet</option></select></label><label>Accent<input type="color" data-pref="accent"></label><label>Background<input type="color" data-pref="background"></label><label>Text scale<input type="range" min="90" max="125" step="5" data-pref="scale"></label><label>Animation<select data-pref="motion"><option value="subtle">Subtle</option><option value="off">Off / reduced graphics</option></select></label><label>Home scene<select data-pref="scene"><option value="landscape">River frontier</option><option value="industrial">Industrial dusk</option><option value="static">Static landscape</option></select></label><label>Shop appearance<select data-pref="shop"><option value="illustrated">Illustrated plans</option><option value="compact">Compact plans</option></select></label><label>Advancement appearance<select data-pref="graph"><option value="evolving">Evolving frames</option><option value="simple">Simple frames</option></select></label><label>Completed line glow<input type="range" min="0" max="1" step="0.05" data-pref="lineGlow"></label><label>Line animation period<input type="range" min="1" max="12" step="1" data-pref="lineSpeed"></label></details><details><summary>Private backgrounds</summary><p>Local images stay on this device. PNG, JPEG or WebP, at most 3 MB and 4096 × 4096 pixels. Images are center-cropped; use position, scale and dimming to adjust. No SVG, scripts or remote image URLs.</p>${['home','graph'].map(key=>`<h4>${key==='home'?'Homepage':'Advancements'}</h4><label>Choose image<input type="file" accept="image/png,image/jpeg,image/webp" data-image="${key}"></label><button data-remove-image="${key}">Remove ${key} image</button><label>Horizontal position<input type="range" min="0" max="100" data-pref="${key}X"></label><label>Vertical position<input type="range" min="0" max="100" data-pref="${key}Y"></label><label>Dimming<input type="range" min="20" max="90" data-pref="${key}Dim"></label>`).join('')}<label>Image crop scale<input type="range" min="100" max="200" data-pref="imageZoom"></label><p data-image-status role="status"></p></details><details id="mf-audio"><summary>Audio</summary><label><input type="checkbox" data-pref="mute"> Mute sounds (default)</label>${['master','ui','music','environment'].map(key=>`<label>${key==='ui'?'Interface':key[0].toUpperCase()+key.slice(1)} volume<input type="range" min="0" max="1" step="0.05" data-pref="${key}"></label>`).join('')}<button data-test-audio>Test interface sound</button><p>Original synthesized UI tones. No music or environmental tracks are installed; their levels are reserved. Reduced motion also silences UI tones.</p></details><details><summary>Gameplay & graphics</summary><p>Existing graphics, density, shadows and traffic controls remain below. Basic 2D is active; Regular 3D stays paused. Camera: drag to pan, wheel to zoom; R rotates placement, Escape cancels.</p></details><details><summary>Friends & Privacy / Chat & Safety</summary><p>Private messages, presence privacy and block/report settings are unavailable pending a verified social backend. No local private background is uploaded.</p></details><details><summary>Minigames / Multiplayer</summary><p>Minigames and multiplayer industry are planned. Current authentication and territory ownership remain unchanged. No resource spending is enabled for Central World.</p></details><p>Theme-pack import is reserved. Executable scripts and arbitrary CSS are never accepted.</p><button data-reset-studio>Reset studio preferences</button>`;
    panel.querySelector('header').after(section);
    for(const el of section.querySelectorAll('[data-pref]')){const key=el.dataset.pref;if(el.type==='checkbox')el.checked=!!prefs[key];else el.value=prefs[key];el.addEventListener('change',()=>{prefs[key]=el.type==='checkbox'?el.checked:el.type==='range'?Number(el.value):el.value;if(key==='theme'){const colors={frontier:['#6be2de','#07131f'],midnight:['#84d8f2','#080e19'],forest:['#9ce0a5','#101f1b'],gold:['#efcb8b','#201b14'],violet:['#cab1fa','#181328']}[prefs.theme];prefs.accent=colors[0];prefs.background=colors[1];section.querySelector('[data-pref="accent"]').value=prefs.accent;section.querySelector('[data-pref="background"]').value=prefs.background;}savePrefs();});}
    section.querySelector('[data-worlds]').onclick=()=>worldManager();section.querySelector('[data-account]').onclick=account;
    section.querySelectorAll('[data-jump]').forEach(b=>b.onclick=()=>{const target=section.querySelector('#mf-'+b.dataset.jump);target.open=true;target.scrollIntoView({block:'nearest'});});
    section.querySelector('[data-test-audio]').onclick=()=>{if(prefs.mute)V.announce('Unmute interface sounds to hear a preview.');else tone('unlock');};
    section.querySelectorAll('[data-image]').forEach(input=>input.onchange=async()=>{const status=section.querySelector('[data-image-status]');try{const file=input.files[0];if(!file)return;if(!['image/png','image/jpeg','image/webp'].includes(file.type)||file.size>3*1024*1024)throw Error('Use a PNG, JPEG or WebP image no larger than 3 MB.');F.imageDimensions(await file.arrayBuffer(),file.type);const bitmap=await createImageBitmap(file);const valid=bitmap.width>=32&&bitmap.height>=32&&bitmap.width<=4096&&bitmap.height<=4096;if(!valid){bitmap.close();throw Error('Image dimensions must be between 32 and 4096 pixels per side.');}const canvas=document.createElement('canvas');canvas.width=bitmap.width;canvas.height=bitmap.height;canvas.getContext('2d').drawImage(bitmap,0,0);bitmap.close();const clean=await new Promise(resolve=>canvas.toBlob(resolve,'image/webp',0.9));if(!clean)throw Error('Image could not be encoded.');await background(input.dataset.image,clean);status.textContent='Private background saved on this device.';}catch(e){status.textContent=e.message;}});
    section.querySelectorAll('[data-remove-image]').forEach(b=>b.onclick=async()=>{try{await background(b.dataset.removeImage,null);section.querySelector('[data-image-status]').textContent='Private image removed.';}catch(e){section.querySelector('[data-image-status]').textContent=e.message;}});
    section.querySelector('[data-reset-studio]').onclick=()=>{localStorage.removeItem(PREF);location.reload();};
  }
  function nav(){
    const dock=document.getElementById('mgDock');if(!dock||dock.querySelector('[data-mf="advancements"]'))return;
    for(const [id,text,fn] of [['advancements','Goals',advancements],['worlds','Backups',()=>worldManager()]]){const b=document.createElement('button');b.dataset.mf=id;b.textContent=text;b.title=text;b.onclick=fn;dock.append(b);}
    const mark=document.querySelector('.mg-brand-lockup div span');if(mark)mark.textContent='MODERN FRONTIER';
  }
  home();studio();nav();
  if(restoreError){
    // A second tab must never roll back an in-progress locked transaction.
    if(navigator.locks)navigator.locks.request('mapgame-singleplayer-economy-writer',{ifAvailable:true},lock=>{
      if(!lock)return;
      try{if(F.recover(localStorage))location.reload();}catch(e){restoreError=e.message;const el=document.getElementById('mgBootState');if(el)el.textContent='WORLD RECOVERY REQUIRED: '+restoreError;}
    }).catch(()=>{});
    const status=document.getElementById('mgBootState');if(status)status.textContent='WORLD RECOVERY REQUIRED: '+restoreError;
    document.addEventListener('click',e=>{if(e.target.closest('#mgStartSingle,#mgJoinCentral')){e.preventDefault();e.stopImmediatePropagation();V.announce('World recovery is blocked. Preserve the rollback journal and free local storage before reloading.');}},true);
  }
  E.subscribe(s=>{nav();update(s);});
  window.addEventListener('mapgame:runtime-ready',()=>{studio();nav();});
  // This is UI inspection only, not another simulation timer. No renderer loop hooks.
  const observer=new MutationObserver(()=>{if(dialog?.hidden)dialog.dataset.view='';});
  observer.observe(document.body,{attributes:true,attributeFilter:['data-world']});
  for(const key of ['home','graph'])background(key,null,true).catch(()=>{});
  window.mapGameFrontier={preferences:()=>({...prefs}),tone,worldManager,advancements,account,close,exportWorld,progress:()=>world?JSON.parse(JSON.stringify(world)):null,metrics:()=>({...metrics}),FAVORITES};
})();
