/* PREGAME STATUS CORRECTION V51 */
(() => {
  'use strict';

  const KEY='parlayTracker.savedTickets.v1';
  const MLB_SCHEDULE='https://statsapi.mlb.com/api/v1/schedule';
  const ALIASES={AZ:'ARI',ARI:'ARI',OAK:'ATH',ATH:'ATH',KCR:'KC',KC:'KC',CHW:'CWS',CWS:'CWS',SDP:'SD',SD:'SD',SFG:'SF',SF:'SF',TBR:'TB',TB:'TB',WSN:'WSH',WAS:'WSH',WSH:'WSH'};
  const cache=new Map();
  let running=false;
  let queued=false;

  const clean=v=>String(v??'').trim();
  const code=v=>ALIASES[clean(v).toUpperCase()]||clean(v).toUpperCase();
  const gameKey=value=>{
    const parts=clean(value).split('@');
    return parts.length===2?`${code(parts[0])}@${code(parts[1])}`:clean(value);
  };
  const dateDash=value=>{
    const v=clean(value).replace(/[^0-9]/g,'').slice(0,8);
    return v.length===8?`${v.slice(0,4)}-${v.slice(4,6)}-${v.slice(6)}`:v;
  };
  const loadSaved=()=>{
    try{const x=JSON.parse(localStorage.getItem(KEY)||'[]');return Array.isArray(x)?x:[]}
    catch{return[]}
  };

  async function scheduleFor(date){
    const key=dateDash(date);
    if(cache.has(key))return cache.get(key);
    const promise=fetch(`${MLB_SCHEDULE}?sportId=1&date=${encodeURIComponent(key)}&hydrate=team`,{cache:'no-store'})
      .then(r=>{if(!r.ok)throw new Error(`HTTP ${r.status}`);return r.json()})
      .then(data=>(data.dates||[]).flatMap(d=>d.games||[]));
    cache.set(key,promise);
    try{return await promise}catch(error){cache.delete(key);throw error}
  }

  function scheduleCode(team){return code(team?.team?.abbreviation||team?.abbreviation||'')}
  function instanceValue(ticket,leg,name){const C=window.ParlayTrackerCore;return C?.instanceValue?C.instanceValue(ticket,leg,name):(leg?.[name]??ticket?.[name])}
  function scheduledStartKey(game){const C=window.ParlayTrackerCore;return C?.gameStartCT?C.gameStartCT({date:game?.gameDate}):''}
  function findScheduledGame(games,value,ticket={},leg={},record={}){
    const wanted=gameKey(value);
    const matches=games.filter(game=>`${scheduleCode(game.teams?.away)}@${scheduleCode(game.teams?.home)}`===wanted).sort((a,b)=>new Date(a?.gameDate||0)-new Date(b?.gameDate||0));
    if(!matches.length)return null;
    const pk=Number(instanceValue(ticket,leg,'gamePk'));if(Number.isFinite(pk)){const exact=matches.find(game=>Number(game.gamePk)===pk);if(exact)return exact}
    const wantedStart=clean(instanceValue(ticket,leg,'gameStart'));if(wantedStart){const exact=matches.find(game=>scheduledStartKey(game)===wantedStart);if(exact)return exact}
    const ordinal=Number(instanceValue(ticket,leg,'gameNumber'));if(Number.isInteger(ordinal)&&ordinal>=1&&ordinal<=matches.length)return matches[ordinal-1];
    const ref=new Date(instanceValue(ticket,leg,'gameSavedAt')||record?.savedAt||record?.createdAt||record?.updatedAt||'').getTime();
    if(Number.isFinite(ref)){const nearest=matches.reduce((best,game)=>{const time=new Date(game?.gameDate||'').getTime();if(!Number.isFinite(time))return best;const distance=Math.abs(time-ref);return !best||distance<best.distance?{game,distance}:best},null);if(nearest)return nearest.game}
    return matches[0];
  }
  function startDate(game){
    const raw=game?.gameDate||game?.officialDate;
    if(!raw)return null;
    const d=new Date(raw);
    return Number.isNaN(d.getTime())?null:d;
  }
  function displayTime(date){return date.toLocaleTimeString([],{hour:'numeric',minute:'2-digit'})}

  function visibleRecord(){
    const params=new URLSearchParams(location.hash.slice(1));
    const id=params.get('ticket');
    const active=params.get('view')==='active';
    const list=loadSaved();
    if(id)return list.find(record=>record.id===id)||null;
    if(active)return list.filter(record=>record.status!=='completed');
    return null;
  }

  function setLegPending(element,leg,game,time){
    const status=element.querySelector('.liveStatus');
    if(status){
      status.className='liveStatus PENDING';
      status.textContent='PENDING';
    }
    const meta=element.querySelector('.liveLegMeta');
    if(meta)meta.textContent=[game,time,leg.team,leg.player].filter(Boolean).join(' · ');
    const value=element.querySelector('.liveLegValue');
    if(value){
      value.classList.remove('valueWin','valueLoss','valuePush','valueSuspended','valueTie','valueAhead1','valueAhead2','valueAhead3','valueBehind1','valueBehind2','valueBehind3');
      value.classList.add('valuePending');
      if(['total_over','total_under','team_total_over','team_total_under','f5_total_over','f5_total_under'].includes(leg.type))value.textContent=`0 / ${leg.target}`;
      else if(['ml','f5_ml'].includes(leg.type))value.textContent='0-0';
    }
  }

  function refreshCardSummary(card){
    const statuses=[...card.querySelectorAll('.liveStatus')].map(node=>clean(node.textContent).toUpperCase()).filter(Boolean);
    const counts={};
    statuses.forEach(status=>counts[status]=(counts[status]||0)+1);
    const summary=card.querySelector('.liveSummary');
    if(summary)summary.textContent=Object.entries(counts).map(([status,count])=>`${count} ${status}`).join(' · ');
    let outcome='PENDING';
    if(statuses.includes('LOSS'))outcome='LOST';
    else if(statuses.includes('UNAVAILABLE'))outcome='SUSPENDED';
    else if(statuses.length&&statuses.every(status=>status==='VOID'))outcome='PUSH';
    else if(statuses.length&&statuses.every(status=>status==='WIN'||status==='VOID'))outcome='WON';
    else if(statuses.includes('LIVE'))outcome='LIVE';
    const badge=card.querySelector('.ticketOutcome');
    if(badge){badge.className=`ticketOutcome ${outcome}`;badge.textContent=`TICKET ${outcome}`}
  }

  async function correctRecord(record,card){
    const ticket=record?.ticket||{};
    const legs=ticket.legs||[];
    const elements=[...card.querySelectorAll('.liveLeg')];
    const schedules=new Map();
    for(let index=0;index<legs.length;index++){
      const leg=legs[index],element=elements[index];
      if(!element)continue;
      const league=clean(leg.league||ticket.league).toUpperCase();
      if(league&&league!=='MLB')continue;
      const game=clean(leg.game||ticket.game),date=clean(leg.date||ticket.date);
      if(!game||!date)continue;
      if(!schedules.has(date))schedules.set(date,await scheduleFor(date));
      const scheduled=findScheduledGame(schedules.get(date),game,ticket,leg,record);
      const start=startDate(scheduled);
      if(start&&Date.now()<start.getTime())setLegPending(element,leg,game,displayTime(start));
    }
    refreshCardSummary(card);
  }

  async function correct(){
    if(running){queued=true;return}
    running=true;
    try{
      const visible=visibleRecord();
      const cards=[...document.querySelectorAll('.liveGrid .liveTicketCard')];
      if(Array.isArray(visible)){
        for(let i=0;i<Math.min(visible.length,cards.length);i++)await correctRecord(visible[i],cards[i]);
      }else if(visible&&cards[0])await correctRecord(visible,cards[0]);
    }catch(error){console.warn('Pregame status correction failed',error)}
    finally{
      running=false;
      if(queued){queued=false;setTimeout(correct,0)}
    }
  }

  function install(){
    const grid=document.querySelector('.liveGrid');
    if(!grid)return false;
    const observer=new MutationObserver(()=>setTimeout(correct,0));
    observer.observe(grid,{childList:true,subtree:true});
    setTimeout(correct,0);
    const original=window.__parlayLiveRefresh;
    if(typeof original==='function'&&!original.__pregameWrapped){
      const wrapped=function(...args){const out=original.apply(this,args);setTimeout(correct,300);return out};
      wrapped.__pregameWrapped=true;
      window.__parlayLiveRefresh=wrapped;
    }
    return true;
  }

  const start=()=>{if(install())return;let tries=0;const timer=setInterval(()=>{if(install()||++tries>40)clearInterval(timer)},250)};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();
