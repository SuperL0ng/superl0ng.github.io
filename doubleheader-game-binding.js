/* DOUBLEHEADER GAME BINDING V1 — preserve the selected event instance */
(() => {
  'use strict';
  const MAN='__manual__';
  const clean=value=>String(value??'').trim();
  const ymd=value=>clean(value).replace(/\D/g,'').slice(0,8);

  function selectDate(select){
    const leg=select?.closest?.('.leg');
    return ymd(leg?.querySelector?.('.ldate')?.value||document.getElementById('date')?.value||'');
  }
  function parseLabelStart(label,date){
    const match=clean(label).match(/\b(\d{1,2}):(\d{2})\s*([ap])\.?m\.?\s*(?:ct)?\b/i);
    if(!match||date.length!==8)return'';
    let hour=Number(match[1])%12;if(match[3].toLowerCase()==='p')hour+=12;
    return `${date}T${String(hour).padStart(2,'0')}${match[2]}`;
  }
  function normalizeStart(raw,date){
    const value=clean(raw);if(/^\d{8}T\d{4}$/.test(value))return value;
    const C=window.ParlayTrackerCore;if(value&&C?.gameStartCT){const key=C.gameStartCT({date:value});if(key)return key}
    return parseLabelStart(value,date);
  }
  function decorateOptions(select,items){
    if(!select?.matches?.('#ticketGame,.lgame'))return;
    const date=selectDate(select),source=Array.isArray(items)?items:[];
    const options=[...select.options].filter(option=>option.value&&option.value!==MAN);
    options.forEach((option,index)=>{
      const item=source[index];
      if(item&&typeof item==='object'){
        const id=clean(item.gameId||item.eventId||item.id||item.uid);if(id)option.dataset.gameId=id;
        const pk=clean(item.gamePk);if(pk)option.dataset.gamePk=pk;
        const start=normalizeStart(item.gameStart||item.startTime||item.start||item.date||item.gameDate,date);if(start)option.dataset.gameStart=start;
        const number=Number(item.gameNumber||item.doubleHeaderGame);if(Number.isInteger(number)&&number>0)option.dataset.gameNumber=String(number);
      }
      if(!option.dataset.gameStart){const start=parseLabelStart(option.dataset.fullLabel||option.textContent,date);if(start)option.dataset.gameStart=start}
    });
  }
  function bindingFor(select){
    const option=select?.options?.[select.selectedIndex];
    if(!option||!option.value||option.value===MAN)return{};
    const same=[...select.options].filter(candidate=>candidate.value===option.value);
    const ordinal=Number(option.dataset.gameNumber)||((same.length>1)?same.indexOf(option)+1:0);
    return{gameId:clean(option.dataset.gameId),gamePk:clean(option.dataset.gamePk),gameStart:clean(option.dataset.gameStart)||parseLabelStart(option.dataset.fullLabel||option.textContent,selectDate(select)),gameNumber:ordinal||undefined,gameSavedAt:new Date().toISOString()};
  }
  function applyBinding(target,binding){
    if(!target)return;
    for(const name of ['gameId','gamePk','gameStart','gameNumber','gameSavedAt']){
      const value=binding?.[name];if(value!==undefined&&value!==null&&value!=='')target[name]=value;
    }
  }
  function chooseOption(select,source){
    if(!select||!source?.game)return;
    const candidates=[...select.options].filter(option=>option.value===source.game);
    if(!candidates.length)return;
    let option=null;
    if(source.gameId)option=candidates.find(candidate=>candidate.dataset.gameId===String(source.gameId));
    if(!option&&source.gamePk)option=candidates.find(candidate=>candidate.dataset.gamePk===String(source.gamePk));
    if(!option&&source.gameStart)option=candidates.find(candidate=>(candidate.dataset.gameStart||parseLabelStart(candidate.dataset.fullLabel||candidate.textContent,selectDate(select)))===source.gameStart);
    const ordinal=Number(source.gameNumber);if(!option&&Number.isInteger(ordinal)&&ordinal>=1&&ordinal<=candidates.length)option=candidates[ordinal-1];
    if(option)select.selectedIndex=[...select.options].indexOf(option);
  }

  const originalRender=window.renderOptions;
  if(typeof originalRender==='function'&&!originalRender.__doubleheaderWrapped){
    const wrapped=function(select,items,...args){const out=originalRender.call(this,select,items,...args);decorateOptions(select,items);return out};
    wrapped.__doubleheaderWrapped=true;window.renderOptions=wrapped;
  }

  const originalRaw=window.rawTicket;
  if(typeof originalRaw==='function'&&!originalRaw.__doubleheaderWrapped){
    const wrapped=function(...args){
      const ticket=originalRaw.apply(this,args),ticketSelect=document.getElementById('ticketGame');
      applyBinding(ticket,bindingFor(ticketSelect));
      const elements=typeof window.includedLegElements==='function'?window.includedLegElements():[...document.querySelectorAll('#legs>.leg')];
      (ticket.legs||[]).forEach((leg,index)=>{const select=ticket.type==='parlay'?elements[index]?.querySelector('.lgame'):ticketSelect;applyBinding(leg,bindingFor(select))});
      return ticket;
    };
    wrapped.__doubleheaderWrapped=true;window.rawTicket=wrapped;
  }

  function restoreRecord(record){
    const ticket=record?.ticket||{};chooseOption(document.getElementById('ticketGame'),ticket);
    const elements=[...document.querySelectorAll('#legs>.leg')];
    elements.forEach((element,index)=>chooseOption(element.querySelector('.lgame'),ticket.legs?.[index]||ticket));
    try{window.syncLegs?.()}catch{}try{window.preview?.()}catch{}
  }
  const originalLoad=window.loadRecordIntoBuilder;
  if(typeof originalLoad==='function'&&!originalLoad.__doubleheaderWrapped){
    const wrapped=function(record,...args){const out=originalLoad.call(this,record,...args);for(const delay of [0,120,500,1200,2400])setTimeout(()=>restoreRecord(record),delay);return out};
    wrapped.__doubleheaderWrapped=true;window.loadRecordIntoBuilder=wrapped;
  }

  document.addEventListener('change',event=>{
    const select=event.target.closest?.('#ticketGame,.lgame');if(!select)return;
    decorateOptions(select,[]);
    if(select.id==='ticketGame'){
      const binding=bindingFor(select),value=select.value;
      setTimeout(()=>document.querySelectorAll('#legs>.leg').forEach(leg=>{if(leg.dataset.ticketGameInherited!=='1')return;const child=leg.querySelector('.lgame');const source={game:value,...binding};chooseOption(child,source)}),0);
    }
  },true);
})();
