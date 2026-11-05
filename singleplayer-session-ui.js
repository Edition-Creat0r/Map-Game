// Same-origin, same-profile coordination only. Web Locks remain authoritative;
// BroadcastChannel is solely a user-requested focus hint, never a lease or write.
(() => {
  'use strict';
  const channel=typeof BroadcastChannel==='function'?new BroadcastChannel('mapgame-local-session-ui-v1'):null;
  channel?.addEventListener('message',event=>{if(event.data?.type==='focus-existing'&&window.mapGameEconomy.getStatus().ownsWriter)window.focus();});
  let panel;
  function show(status,retry){
    if(!panel){panel=document.createElement('section');panel.id='mgLocalSessionIssue';panel.className='mg-modal-backdrop';panel.setAttribute('role','dialog');panel.setAttribute('aria-modal','true');panel.setAttribute('aria-label','Local Singleplayer session');panel.innerHTML='<div class="mg-auth-card"><h2 data-title></h2><p data-message role="status"></p><p>This local world needs no account. Saves are isolated by browser profile, host and port.</p><button class="mg-btn mg-btn-secondary" data-existing>Return to existing session</button> <button class="mg-btn mg-btn-primary" data-retry>Retry local session</button> <button class="mg-btn mg-btn-secondary" data-home>Stay on Home</button><p data-focus-note></p></div>';document.body.append(panel);window.mapGameVisuals?.trapDialog(panel);panel.querySelector('[data-home]').onclick=()=>{hide();document.querySelector('#mgStartSingle')?.focus();};panel.addEventListener('keydown',e=>{if(e.key==='Escape'){e.stopPropagation();panel.querySelector('[data-home]').click();}});}
    panel.querySelector('[data-title]').textContent=status.conflict?'This local world is already open':'Local world could not start';
    panel.querySelector('[data-message]').textContent=status.error||'Local save protection is not ready. Retry after closing the other session.';
    panel.querySelector('[data-existing]').hidden=!status.conflict;
    panel.querySelector('[data-existing]').onclick=()=>{channel?.postMessage({type:'focus-existing'});panel.querySelector('[data-focus-note]').textContent='Switch to your existing Map Game tab. Browsers may block automatic focus; no tab has been closed.';};
    panel.querySelector('[data-home]').textContent='Stay on Home';panel.querySelector('[data-retry]').textContent='Retry local session';
    panel.querySelector('[data-retry]').onclick=retry;panel.hidden=false;panel.querySelector('[data-home]').focus();
  }
  function hide(){if(panel)panel.hidden=true;}
  window.addEventListener('mapgame:local-session-conflict',()=>{if(window.mapGameRuntime?.getMode?.()&&window.mapGameRuntime.getMode()!=='HOME'){show(window.mapGameEconomy.getStatus(),()=>location.reload());panel.querySelector('[data-retry]').textContent='Reload Home to retry';panel.querySelector('[data-home]').textContent='Keep viewing (read-only)';}});
  window.mapGameLocalSessionUI={show,hide};
})();
