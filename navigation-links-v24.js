/* Native ticket-view navigation V26 — preserve stable ticket identity on upgraded links */
(()=>{
  'use strict';

  const css=document.createElement('style');
  css.textContent=`
    a.navAction{
      display:inline-flex;align-items:center;justify-content:center;
      min-height:39px;padding:12px 10px;border:1px solid rgba(105,116,130,.55);
      border-radius:8px;color:#111820;text-decoration:none;
      background:linear-gradient(180deg,#f8fbff,#d7dee8 48%,#7e8a99);
      font:900 13px -apple-system,BlinkMacSystemFont,"SF Pro Display","Segoe UI",sans-serif;
      text-transform:uppercase;letter-spacing:.07em;
      box-shadow:inset 0 1px 0 rgba(255,255,255,.75),inset 0 -1px 0 rgba(0,0,0,.28),0 4px 8px rgba(0,0,0,.18)
    }
    .savedActions a.navAction{width:100%}
  `;
  document.head.appendChild(css);

  function showHashView(){
    if(!/^#(?:ticket=|view=active)/.test(location.hash))return;
    if(typeof window.renderStandaloneMode==='function')window.renderStandaloneMode();
    setTimeout(()=>window.dispatchEvent(new Event('parlay:viewchange')),0);
  }

  function returnToTickets(){
    history.pushState(null,'',location.href.split('#')[0]);
    const standalone=document.getElementById('standaloneView');
    const dashboard=document.getElementById('dashboardView');
    const tabs=document.getElementById('appTabs');
    standalone?.classList.add('hide');
    dashboard?.classList.remove('hide');
    tabs?.classList.remove('hide');
    if(typeof window.renderTicketDashboard==='function')window.renderTicketDashboard();
    window.dispatchEvent(new Event('parlay:viewchange'));
    window.scrollTo({top:0,behavior:'smooth'});
  }

  window.closeStandaloneViewer=returnToTickets;
  window.openSavedTicketView=id=>{location.hash='ticket='+encodeURIComponent(id)};
  window.openActiveTicketsView=()=>{location.hash='view=active'};

  function replaceButtonWithLink(button,href){
    if(!button||button.tagName==='A')return button;
    const link=document.createElement('a');
    link.href=href;
    link.className=(button.className+' navAction').trim();
    link.id=button.id;
    link.textContent=button.textContent;
    link.setAttribute('role','button');
    const onclick=button.getAttribute('onclick');
    if(onclick)link.setAttribute('onclick',onclick);
    button.replaceWith(link);
    return link;
  }

  function upgradeLinks(){
    const active=document.getElementById('viewActiveBtn');
    if(active&&active.tagName!=='A')replaceButtonWithLink(active,'#view=active');

    document.querySelectorAll('.savedActions button').forEach(button=>{
      const onclick=button.getAttribute('onclick')||'';
      const match=onclick.match(/openSavedTicketView\('([^']+)'\)/);
      if(match)replaceButtonWithLink(button,'#ticket='+encodeURIComponent(match[1]));
    });
  }

  const originalRender=window.renderTicketDashboard;
  if(typeof originalRender==='function'){
    window.renderTicketDashboard=function(){
      const value=originalRender.apply(this,arguments);
      requestAnimationFrame(upgradeLinks);
      return value;
    };
  }

  window.addEventListener('hashchange',showHashView);
  window.addEventListener('popstate',()=>{
    if(location.hash)showHashView();else returnToTickets();
  });
  const observer=new MutationObserver(()=>requestAnimationFrame(upgradeLinks));
  observer.observe(document.documentElement,{subtree:true,childList:true});

  const start=()=>{upgradeLinks();if(location.hash)showHashView()};
  document.readyState==='loading'?window.addEventListener('DOMContentLoaded',start,{once:true}):start();
})();
/* Load whole-library backup tools. */
(()=>{if(document.querySelector('script[data-library-backup]'))return;const s=document.createElement('script');s.dataset.libraryBackup='1';s.src='./library-backup.js?v=1';document.head.appendChild(s)})();