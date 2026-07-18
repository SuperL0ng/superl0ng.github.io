/* SHOW LEGS LABEL FIX V3 — stable labels and ticket-ID-safe dashboard binding */
(() => {
  'use strict';

  const KEY='parlayTracker.savedTickets.v1';
  const STYLE_ID='showLegsLabelFixCss';
  const loading=new Map();
  let repairQueued=false,stampQueued=false;

  const esc=value=>window.esc?window.esc(value):String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  const records=()=>{try{const list=window.loadSavedTickets?.()||JSON.parse(localStorage.getItem(KEY)||'[]');return Array.isArray(list)?list:[]}catch{return[]}};
  const recordById=id=>records().find(record=>String(record?.id||'')===String(id||''))||null;

  function addCss(){
    if(document.getElementById(STYLE_ID))return;
    const style=document.createElement('style');
    style.id=STYLE_ID;
    style.textContent=`
      #ticketList .ticketExpandBtn,
      #ticketList .ticketExpandBtn.ticketDetailsAction,
      #ticketList .ticketExpandBtn.webkitPaintLayer{
        display:flex!important;align-items:center!important;justify-content:center!important;
        box-sizing:border-box!important;overflow:visible!important;text-overflow:clip!important;
        white-space:nowrap!important;padding-left:4px!important;padding-right:4px!important;
        letter-spacing:0!important;text-indent:0!important;-webkit-transform:none!important;
        transform:none!important;-webkit-backface-visibility:visible!important;
        backface-visibility:visible!important;clip-path:none!important;-webkit-clip-path:none!important;
        contain:none!important;mask:none!important;-webkit-mask:none!important
      }
    `;
    document.head.appendChild(style);
  }

  function ticketIdFromCard(card){
    const link=card?.querySelector?.('a[href*="#ticket="]');
    const href=String(link?.getAttribute?.('href')||'');
    if(href.includes('#')){
      const id=new URLSearchParams(href.slice(href.indexOf('#')+1)).get('ticket');
      if(id)return id;
    }
    const action=card?.querySelector?.('[onclick*="openSavedTicketView"]');
    const match=String(action?.getAttribute?.('onclick')||'').match(/openSavedTicketView\(\s*(['"])(.*?)\1\s*\)/);
    return match?.[2]||String(card?.dataset?.ticketId||'');
  }

  function stabilizeCardId(card){
    const id=ticketIdFromCard(card);
    if(id&&String(card.dataset.ticketId||'')!==id)card.dataset.ticketId=id;
    return id;
  }

  function labelButton(button,record){
    if(!button)return;
    const open=button.getAttribute('aria-expanded')==='true';
    const straight=String(record?.ticket?.type||'').toLowerCase()==='straight';
    const compact=window.matchMedia('(max-width:340px)').matches;
    const label=compact?(open?'Hide':'Show'):`${open?'Hide':'Show'} ${straight?'Pick':'Legs'}`;
    if(button.classList.contains('webkitPaintLayer'))button.classList.remove('webkitPaintLayer');
    if(button.textContent!==label)button.textContent=label;
  }

  function datesFor(record){
    const out=[],ticket=record?.ticket||{};
    if(ticket.date)out.push(ticket.date);
    for(const leg of ticket.legs||[])if(leg.date)out.push(leg.date);
    return [...new Set(out)];
  }

  const stateClass=state=>String(state||'pending').toUpperCase();
  const valueClass=state=>state==='win'?'valueWin':state==='loss'?'valueLoss':state==='push'?'valuePush':state==='suspended'||state==='unavailable'?'valueSuspended':'valuePending';
  function detailsHtml(record){
    const C=window.ParlayTrackerCore,ticket=record?.ticket||{};
    if(!C)return '<div class="dashboardDetailsMessage">Tracker engine unavailable.</div>';
    return (record?.__evaluated||[]).map(leg=>{
      const live=leg.__live||C.statusObj('pending',''),game=leg.__game,state=stateClass(live.state);
      const meta=ticket.type==='sgp'?[game?C.baseGameMeta(game):'']:[C.legGame(ticket,leg),game?C.baseGameMeta(game):''];
      return `<div class="dashboardLeg leg${state}"><div><div class="dashboardLegLabel">${esc(leg.label||'Untitled')}</div><div class="dashboardLegMeta">${esc(meta.filter(Boolean).join(' · '))}</div></div><div class="dashboardLegRight"><div class="dashboardLegValue ${esc(live.valueClass||valueClass(live.state))}">${esc(live.value||'')}</div><span class="dashboardLegStatus ${state}">${esc(state)}</span></div></div>`;
    }).join('')||'<div class="dashboardDetailsMessage">No legs in this ticket.</div>';
  }

  async function evaluateCard(card,panel){
    const id=stabilizeCardId(card),record=recordById(id);
    if(!record||!panel)return;
    const token=Symbol(id);loading.set(id,token);
    panel.innerHTML='<div class="dashboardDetailsMessage">Refreshing leg status…</div>';
    try{
      const S=window.ParlayTrackerSources,E=window.ParlayTrackerEvaluator;
      if(!S||!E)throw new Error('Tracker engine unavailable');
      S.resetTrackingCaches?.();
      const games=await S.fetchScoreboards(datesFor(record));
      const evaluated=await E.evaluateRecord(record,games);
      if(loading.get(id)===token&&!panel.classList.contains('hide'))panel.innerHTML=detailsHtml(evaluated);
    }catch(error){
      if(loading.get(id)===token&&!panel.classList.contains('hide'))panel.innerHTML=`<div class="dashboardDetailsMessage">Unable to refresh leg status: ${esc(error?.message||error)}</div>`;
    }finally{if(loading.get(id)===token)loading.delete(id)}
  }

  function syncExpandAll(){
    const control=document.getElementById('toggleAllTicketsBtn');
    if(!control)return;
    const anyOpen=[...document.querySelectorAll('#ticketList .ticketExpandBtn[data-ticket-binding-fix]')].some(button=>button.getAttribute('aria-expanded')==='true');
    control.textContent=anyOpen?'Collapse All':'Expand All';
    control.setAttribute('aria-pressed',String(anyOpen));
    control.setAttribute('aria-label',anyOpen?'Collapse all ticket details':'Expand all ticket details');
  }

  function setOpen(card,open,refresh=true){
    const button=card?.querySelector?.('.ticketExpandBtn'),panel=card?.querySelector?.('.savedTicketDetails');
    if(!button||!panel)return;
    button.setAttribute('aria-expanded',String(open));
    panel.classList.toggle('hide',!open);
    labelButton(button,recordById(stabilizeCardId(card)));
    if(open&&refresh)evaluateCard(card,panel);
    syncExpandAll();
  }

  function bindCard(card){
    const id=stabilizeCardId(card),current=card.querySelector('.ticketExpandBtn');
    if(!id||!current)return;
    if(current.dataset.ticketBindingFix===id){labelButton(current,recordById(id));return}
    const button=current.cloneNode(true);
    button.dataset.ticketBindingFix=id;
    current.replaceWith(button);
    button.addEventListener('click',event=>{
      event.preventDefault();event.stopPropagation();event.stopImmediatePropagation();
      setOpen(card,button.getAttribute('aria-expanded')!=='true',true);
    });
    labelButton(button,recordById(id));
  }

  function repairDashboard(){
    document.querySelectorAll('#ticketList .savedTicket').forEach(bindCard);
    syncExpandAll();
  }

  function queueRepair(){
    if(repairQueued)return;
    repairQueued=true;
    requestAnimationFrame(()=>{repairQueued=false;repairDashboard()});
  }

  function formatStamp(value){
    const date=new Date(value||'');
    return Number.isNaN(date.getTime())?'':date.toLocaleString([], {year:'numeric',month:'numeric',day:'numeric',hour:'numeric',minute:'2-digit'});
  }

  function repairStamps(){
    stampQueued=false;
    const params=new URLSearchParams(location.hash.slice(1)),id=params.get('ticket'),active=params.get('view')==='active';
    if(!id&&!active)return;
    const list=records(),eligible=id?list.filter(record=>String(record.id)===String(id)):list.filter(record=>record.status!=='completed');
    const byId=new Map(eligible.map(record=>[String(record.id||''),record]));
    document.querySelectorAll('#standaloneView .liveTicketCard').forEach((card,index)=>{
      const cardId=String(card.dataset.ticketId||''),record=(cardId&&byId.get(cardId))||eligible[index]||null;
      const desired=record?.settledAt?'Settled '+formatStamp(record.settledAt):'';
      const existing=card.querySelector('.settlementStamp');
      if(!desired){existing?.remove();return}
      if(existing?.textContent===desired)return;
      existing?.remove();
      const stamp=document.createElement('span');stamp.className='settlementStamp';stamp.textContent=desired;
      let row=card.querySelector('.ticketOutcomeRow');
      if(!row){const badge=card.querySelector('.ticketOutcome');if(badge){row=document.createElement('div');row.className='ticketOutcomeRow';badge.parentNode.insertBefore(row,badge);row.appendChild(badge)}}
      (row||card).appendChild(stamp);
    });
  }

  function queueStampRepair(){
    if(stampQueued)return;
    stampQueued=true;
    setTimeout(repairStamps,0);
  }

  function wrapDashboard(){
    const original=window.renderTicketDashboard;
    if(typeof original!=='function'||original.__ticketIdBindingV3)return;
    const wrapped=function(...args){const result=original.apply(this,args);requestAnimationFrame(queueRepair);setTimeout(queueRepair,50);return result};
    wrapped.__ticketIdBindingV3=true;
    window.renderTicketDashboard=wrapped;
  }

  function start(){
    addCss();wrapDashboard();queueRepair();queueStampRepair();
    document.addEventListener('click',event=>{
      if(event.target.closest?.('#toggleAllTicketsBtn')){
        event.preventDefault();event.stopPropagation();event.stopImmediatePropagation();
        repairDashboard();
        const cards=[...document.querySelectorAll('#ticketList .savedTicket')];
        const open=!cards.some(card=>card.querySelector('.ticketExpandBtn')?.getAttribute('aria-expanded')==='true');
        cards.forEach(card=>setOpen(card,open,open));
      }
    },true);
    const observer=new MutationObserver(mutations=>{
      if(mutations.some(mutation=>mutation.type==='childList'||mutation.attributeName==='data-ticket-id'))queueRepair();
      if(mutations.some(mutation=>mutation.type==='childList'&&mutation.target.closest?.('#standaloneView')))queueStampRepair();
    });
    observer.observe(document.body,{subtree:true,childList:true,attributes:true,attributeFilter:['data-ticket-id']});
    for(const name of ['parlay:dashboard-refreshed','parlay:tracker-refreshed','parlay:settlement-status-updated'])document.addEventListener(name,()=>{queueRepair();queueStampRepair();setTimeout(queueStampRepair,100)});
    window.addEventListener('hashchange',()=>{queueStampRepair();setTimeout(queueStampRepair,100)});
    window.addEventListener('resize',queueRepair);
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();
