/* DASHBOARD TICKET ID BINDING V5 — stable details, selection, and settlement stamps */
(() => {
  'use strict';

  const KEY='parlayTracker.savedTickets.v1';
  const STYLE_ID='showLegsLabelFixCss';
  const openIds=new Set();
  const selectedIds=new Set();
  const loads=new Map();
  let repairQueued=false;

  const esc=value=>window.esc?window.esc(value):String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  const load=()=>{try{const list=window.loadSavedTickets?.()||JSON.parse(localStorage.getItem(KEY)||'[]');return Array.isArray(list)?list:[]}catch{return[]}};
  const store=list=>{if(typeof window.storeSavedTickets==='function')window.storeSavedTickets(list);else localStorage.setItem(KEY,JSON.stringify(list))};

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

  function idFromAction(card){
    const link=card?.querySelector?.('a[href*="#ticket="],a[href^="#ticket="],button[onclick*="openSavedTicketView"],[onclick*="openSavedTicketView"]');
    if(!link)return'';
    const href=String(link.getAttribute?.('href')||'');
    const hashMatch=href.match(/#ticket=([^&#]+)/);
    if(hashMatch){try{return decodeURIComponent(hashMatch[1])}catch{return hashMatch[1]}}
    const onclick=String(link.getAttribute?.('onclick')||'');
    const callMatch=onclick.match(/openSavedTicketView\(\s*(['"])(.*?)\1\s*\)/);
    return callMatch?.[2]||'';
  }

  function stableId(card){
    const actionId=idFromAction(card);
    const current=String(card?.dataset?.ticketId||'');
    const id=actionId||current;
    if(id&&current!==id)card.dataset.ticketId=id;
    return id;
  }

  function recordFor(card){
    const id=stableId(card);
    return load().find(record=>String(record?.id||'')===id)||null;
  }

  function normalizeLabel(button,record,open){
    if(!button)return;
    const straight=String(record?.ticket?.type||'').toLowerCase()==='straight';
    const compact=window.matchMedia('(max-width:340px)').matches;
    const label=compact?(open?'Hide':'Show'):`${open?'Hide':'Show'} ${straight?'Pick':'Legs'}`;
    button.setAttribute('aria-expanded',String(open));
    button.setAttribute('aria-label',`${open?'Hide':'Show'} ${straight?'pick':'ticket legs'}`);
    button.textContent=label;
    button.classList.remove('webkitPaintLayer');
  }

  function datesFor(record){
    const dates=[],ticket=record?.ticket||{};
    if(ticket.date)dates.push(ticket.date);
    for(const leg of ticket.legs||[])if(leg.date)dates.push(leg.date);
    return [...new Set(dates)];
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

  async function refreshPanel(card,panel){
    const id=stableId(card),record=recordFor(card);
    if(!id||!record||!panel)return;
    const token=Symbol(id);loads.set(id,token);
    panel.innerHTML='<div class="dashboardDetailsMessage">Refreshing leg status…</div>';
    try{
      const sources=window.ParlayTrackerSources,evaluator=window.ParlayTrackerEvaluator;
      if(!sources||!evaluator)throw new Error('Tracker engine unavailable');
      sources.resetTrackingCaches?.();
      const games=await sources.fetchScoreboards(datesFor(record));
      const evaluated=await evaluator.evaluateRecord(record,games);
      if(loads.get(id)===token&&openIds.has(id))panel.innerHTML=detailsHtml(evaluated);
    }catch(error){
      if(loads.get(id)===token&&openIds.has(id))panel.innerHTML=`<div class="dashboardDetailsMessage">Unable to refresh leg status: ${esc(error?.message||error)}</div>`;
    }finally{
      if(loads.get(id)===token)loads.delete(id);
    }
  }

  function setCardOpen(card,open,refresh=true){
    const id=stableId(card),record=recordFor(card),button=card?.querySelector?.('.ticketExpandBtn'),panel=card?.querySelector?.('.savedTicketDetails');
    if(!id||!button||!panel)return;
    if(open)openIds.add(id);else openIds.delete(id);
    panel.classList.toggle('hide',!open);
    normalizeLabel(button,record,open);
    if(open&&refresh)refreshPanel(card,panel);
  }

  function bindExpand(card){
    const id=stableId(card),current=card?.querySelector?.('.ticketExpandBtn');
    if(!id||!current)return;
    if(current.dataset.ticketBindingId===id){normalizeLabel(current,recordFor(card),openIds.has(id));return}
    const button=current.cloneNode(true);
    button.dataset.ticketBindingId=id;
    current.replaceWith(button);
    button.addEventListener('click',event=>{
      event.preventDefault();event.stopPropagation();event.stopImmediatePropagation();
      setCardOpen(card,!openIds.has(id),true);
      syncExpandAll();
    });
    setCardOpen(card,openIds.has(id),openIds.has(id));
  }

  function updateSelectionToolbar(){
    const deleteButton=document.getElementById('deleteSelectedTicketsBtn');
    if(!deleteButton)return;
    deleteButton.textContent=selectedIds.size?`Delete Selected (${selectedIds.size})`:'Delete Selected';
    deleteButton.disabled=selectedIds.size===0;
  }

  function bindCheckbox(card){
    const id=stableId(card),current=card?.querySelector?.('.ticketSelectBox');
    if(!id||!current)return;
    if(current.dataset.ticketBindingId===id){current.value=id;current.checked=selectedIds.has(id);return}
    const box=current.cloneNode(true);
    box.dataset.ticketBindingId=id;box.value=id;box.checked=selectedIds.has(id);
    current.replaceWith(box);
    box.addEventListener('change',()=>{if(box.checked)selectedIds.add(id);else selectedIds.delete(id);updateSelectionToolbar()});
  }

  function syncExpandAll(){
    const button=document.getElementById('toggleAllTicketsBtn');
    if(!button)return;
    const anyOpen=[...document.querySelectorAll('#ticketList .savedTicket')].some(card=>openIds.has(stableId(card)));
    button.textContent=anyOpen?'Collapse All':'Expand All';
    button.setAttribute('aria-pressed',String(anyOpen));
    button.setAttribute('aria-label',anyOpen?'Collapse all ticket details':'Expand all ticket details');
  }

  function repairDashboard(){
    repairQueued=false;
    for(const card of document.querySelectorAll('#ticketList .savedTicket')){
      stableId(card);bindExpand(card);bindCheckbox(card);
    }
    syncExpandAll();updateSelectionToolbar();
  }

  function queueDashboardRepair(){
    if(repairQueued)return;
    repairQueued=true;
    requestAnimationFrame(repairDashboard);
  }

  function formatStamp(value){
    const date=new Date(value||'');
    return Number.isNaN(date.getTime())?'':date.toLocaleString([], {year:'numeric',month:'numeric',day:'numeric',hour:'numeric',minute:'2-digit'});
  }

  function repairStandaloneStamps(){
    const params=new URLSearchParams(location.hash.slice(1)),id=params.get('ticket'),active=params.get('view')==='active';
    if(!id&&!active)return;
    const records=id?load().filter(record=>String(record.id)===String(id)):load().filter(record=>record.status!=='completed');
    const byId=new Map(records.map(record=>[String(record.id||''),record]));
    for(const card of document.querySelectorAll('#standaloneView .liveTicketCard')){
      const record=byId.get(String(card.dataset.ticketId||''));
      const existing=card.querySelector('.settlementStamp');
      const desired=record?.settledAt?'Settled '+formatStamp(record.settledAt):'';
      if(!desired){existing?.remove();continue}
      if(existing?.textContent===desired)continue;
      existing?.remove();
      const stamp=document.createElement('span');stamp.className='settlementStamp';stamp.textContent=desired;
      let row=card.querySelector('.ticketOutcomeRow');
      const outcome=card.querySelector('.ticketOutcome');
      if(!row&&outcome){row=document.createElement('div');row.className='ticketOutcomeRow';outcome.parentNode.insertBefore(row,outcome);row.appendChild(outcome)}
      (row||card).appendChild(stamp);
    }
  }

  function queueStampRepair(){for(const delay of [0,60,220])setTimeout(repairStandaloneStamps,delay)}

  function deleteSelected(){
    if(!selectedIds.size)return;
    const count=selectedIds.size;
    if(!confirm(`Delete ${count} selected ticket${count===1?'':'s'}?`))return;
    store(load().filter(record=>!selectedIds.has(String(record.id||''))));
    for(const id of selectedIds)openIds.delete(id);
    selectedIds.clear();
    const selectButton=document.getElementById('ticketSelectModeBtn');
    if(document.body.classList.contains('ticketSelectMode')){
      if(selectButton)selectButton.click();
      else document.body.classList.remove('ticketSelectMode');
    }
    window.renderTicketDashboard?.();
    setTimeout(repairDashboard,0);
  }

  function install(){
    addCss();queueDashboardRepair();queueStampRepair();
    new MutationObserver(()=>{queueDashboardRepair();queueStampRepair()}).observe(document.body,{subtree:true,childList:true});
    document.addEventListener('click',event=>{
      if(event.target.closest?.('#toggleAllTicketsBtn')){
        event.preventDefault();event.stopPropagation();event.stopImmediatePropagation();
        repairDashboard();
        const cards=[...document.querySelectorAll('#ticketList .savedTicket')];
        const shouldOpen=!cards.some(card=>openIds.has(stableId(card)));
        cards.forEach(card=>setCardOpen(card,shouldOpen,shouldOpen));
        syncExpandAll();return;
      }
      if(event.target.closest?.('#deleteSelectedTicketsBtn')){
        event.preventDefault();event.stopPropagation();event.stopImmediatePropagation();deleteSelected();return;
      }
      if(event.target.closest?.('#ticketSelectModeBtn'))setTimeout(()=>{if(!document.body.classList.contains('ticketSelectMode'))selectedIds.clear();repairDashboard()},0);
      if(event.target.closest?.('#ticketsTab'))for(const delay of [0,60,220])setTimeout(repairDashboard,delay);
    },true);
    for(const name of ['parlay:dashboard-refreshed','parlay:tracker-refreshed','parlay:settlement-status-updated'])document.addEventListener(name,()=>{for(const delay of [0,60,220])setTimeout(repairDashboard,delay);queueStampRepair()});
    window.addEventListener('hashchange',queueStampRepair);
    window.addEventListener('resize',()=>{repairDashboard();queueStampRepair()});
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
})();
