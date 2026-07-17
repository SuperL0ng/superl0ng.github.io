/* PARLAY TRACKER EVALUATOR V54 — Scriptable parity for MLB and basketball player markets */
(() => {
  'use strict';
  const C=window.ParlayTrackerCore,S=window.ParlayTrackerSources;
  const MLB_PLAYER_TYPES=new Set(['pitcher_outs_under','pitcher_ks','pitcher_ks_under','player_hits','player_total_bases','player_runs','player_hr','player_rbi','player_walks','player_stolen_bases','player_hwsb','player_hrrbi']);
  const BASKETBALL_PLAYER_TYPES=new Set(['player_points','player_rebounds','player_assists','player_threes','player_double_double','player_triple_double','player_points_rebounds','player_points_assists','player_rebounds_assists','player_points_rebounds_assists','player_pra','player_pr','player_pa','player_ra','player_blocks']);
  function valClass(state,trend=''){return state==='win'?'valueWin':state==='loss'?'valueLoss':state==='push'?'valuePush':state==='suspended'||state==='unavailable'?'valueSuspended':trend||'valuePending'}
  function milestone(n,target,game){if(n>=target)return C.statusObj('win',C.fmtRecord(n,target),'valueWin');if(C.isSuspended(game))return C.statusObj('suspended',C.fmtRecord(n,target),'valueSuspended');if(C.isFinal(game))return C.statusObj('loss',C.fmtRecord(n,target),'valueLoss');return C.statusObj(C.isLive(game)?'live':'pending',C.isLive(game)?C.fmtRecord(n,target):'',C.isLive(game)?'valuePending':'')}
  function underResult(n,target,game){if(n>target)return C.statusObj('loss',C.fmtRecord(n,target),'valueLoss');if(C.isFinal(game))return C.statusObj('win',C.fmtRecord(n,target),'valueWin');return C.statusObj(C.isLive(game)?'live':'pending',C.isLive(game)?C.fmtRecord(n,target):'',C.isLive(game)?'valuePending':'')}
  async function evalLeg(ticket,leg,games){
    if(leg.type==='void')return{...leg,__live:C.statusObj('push','VOID','valuePush')};
    if(leg.type==='manual'){const n=Number(leg.current??0),target=Number(leg.target??1),state=leg.result==='win'?'win':leg.result==='loss'?'loss':leg.result==='push'?'push':n>=target?'win':'live';return{...leg,__live:C.statusObj(state,state==='push'?'PUSH':C.fmtRecord(n,target),valClass(state))}}
    const key=C.legGame(ticket,leg),game=C.findGame(games,key,ticket,leg);
    if(!game)return{...leg,__live:C.statusObj('pending','')};
    const final=C.isFinal(game),live=C.isLive(game),started=C.hasStarted(game),suspended=C.isSuspended(game),[away,home]=key.split('@'),target=Number(leg.target||0);
    let summary=null,feed=null;
    if(MLB_PLAYER_TYPES.has(leg.type)||BASKETBALL_PLAYER_TYPES.has(leg.type)){const data=await S.loadGameData(ticket,leg,game);summary=data.summary;feed=data.mlbFeed}
    let st;
    switch(leg.type){
      case'ml':{const value=C.gameScoreValue(game,away,home),margin=C.marginForPick(game,key,leg.team,0),trend=C.trendClass(game,margin);st=suspended?C.statusObj('suspended',value,'valueSuspended'):final?C.statusObj(margin>0?'win':'loss',value,valClass(margin>0?'win':'loss')):C.statusObj(live?'live':'pending',live?value:'',live?trend:'');break}
      case'spread':{const value=C.gameScoreValue(game,away,home),margin=C.marginForPick(game,key,leg.team,target),trend=C.trendClass(game,margin);st=suspended?C.statusObj('suspended',value,'valueSuspended'):final?C.statusObj(margin>0?'win':margin===0?'push':'loss',value,valClass(margin>0?'win':margin===0?'push':'loss')):C.statusObj(live?'live':'pending',live?value:'',live?trend:'');break}
      case'f5_ml':{const value=`${C.f5Score(game,away)}-${C.f5Score(game,home)}`,margin=C.f5MarginForPick(game,key,leg.team,0),done=C.f5Complete(game);st=done?C.statusObj(margin>0?'win':'loss',value,valClass(margin>0?'win':'loss')):C.statusObj(live?'live':'pending',live?value:'',live?C.trendClass(game,margin):'');break}
      case'f5_spread':{const value=`${C.f5Score(game,away)}-${C.f5Score(game,home)}`,margin=C.f5MarginForPick(game,key,leg.team,target),done=C.f5Complete(game);st=done?C.statusObj(margin>0?'win':margin===0?'push':'loss',value,valClass(margin>0?'win':margin===0?'push':'loss')):C.statusObj(live?'live':'pending',live?value:'',live?C.trendClass(game,margin):'');break}
      case'f5_total_over':{const n=C.f5Score(game,away)+C.f5Score(game,home);st=n>target?C.statusObj('win',C.fmtRecord(n,target),'valueWin'):C.f5Complete(game)?C.statusObj('loss',C.fmtRecord(n,target),'valueLoss'):C.statusObj(live?'live':'pending',live?C.fmtRecord(n,target):'');break}
      case'f5_total_under':{const n=C.f5Score(game,away)+C.f5Score(game,home);st=n>target?C.statusObj('loss',C.fmtRecord(n,target),'valueLoss'):C.f5Complete(game)?C.statusObj('win',C.fmtRecord(n,target),'valueWin'):C.statusObj(live?'live':'pending',live?C.fmtRecord(n,target):'');break}
      case'team_total_over':{const n=C.score(game,leg.team);st=n>target?C.statusObj('win',C.fmtRecord(n,target),'valueWin'):final?C.statusObj('loss',C.fmtRecord(n,target),'valueLoss'):C.statusObj(live?'live':'pending',live?C.fmtRecord(n,target):'');break}
      case'team_total_under':{const n=C.score(game,leg.team);st=n>target?C.statusObj('loss',C.fmtRecord(n,target),'valueLoss'):final?C.statusObj('win',C.fmtRecord(n,target),'valueWin'):C.statusObj(live?'live':'pending',live?C.fmtRecord(n,target):'');break}
      case'total_over':{const n=C.total(game);st=n>target?C.statusObj('win',C.fmtRecord(n,target),'valueWin'):final?C.statusObj('loss',C.fmtRecord(n,target),'valueLoss'):C.statusObj(live?'live':'pending',live?C.fmtRecord(n,target):'');break}
      case'total_under':{const n=C.total(game);st=n>target?C.statusObj('loss',C.fmtRecord(n,target),'valueLoss'):final?C.statusObj('win',C.fmtRecord(n,target),'valueWin'):C.statusObj(live?'live':'pending',live?C.fmtRecord(n,target):'');break}
      case'pitcher_outs_under':{const n=started?(S.baseballStat('outs',summary,feed,leg.team,leg.player)??0):0;st=underResult(n,target,game);break}
      case'pitcher_ks':{const n=started?(S.baseballStat('ks',summary,feed,leg.team,leg.player)??0):0;st=milestone(n,target,game);break}
      case'pitcher_ks_under':{const n=started?(S.baseballStat('ks',summary,feed,leg.team,leg.player)??0):0;st=underResult(n,target,game);break}
      case'player_hits':{const n=started?(S.baseballStat('hits',summary,feed,leg.team,leg.player)??0):0;st=milestone(n,target,game);break}
      case'player_total_bases':{const n=started?(S.baseballStat('tb',summary,feed,leg.team,leg.player)??0):0;st=milestone(n,target,game);break}
      case'player_runs':{const n=started?(S.baseballStat('runs',summary,feed,leg.team,leg.player)??0):0;st=milestone(n,target,game);break}
      case'player_hr':{const n=started?(S.baseballStat('hr',summary,feed,leg.team,leg.player)??0):0;st=milestone(n,target,game);break}
      case'player_rbi':{const n=started?(S.baseballStat('rbi',summary,feed,leg.team,leg.player)??0):0;st=milestone(n,target,game);break}
      case'player_walks':{const n=started?(S.baseballStat('walks',summary,feed,leg.team,leg.player)??0):0;st=milestone(n,target,game);break}
      case'player_stolen_bases':{const n=started?(S.baseballStat('sb',summary,feed,leg.team,leg.player)??0):0;st=milestone(n,target,game);break}
      case'player_hwsb':{const n=started?((S.baseballStat('hits',summary,feed,leg.team,leg.player)||0)+(S.baseballStat('walks',summary,feed,leg.team,leg.player)||0)+(S.baseballStat('sb',summary,feed,leg.team,leg.player)||0)):0;st=milestone(n,target,game);break}
      case'player_hrrbi':{const n=started?((S.baseballStat('hits',summary,feed,leg.team,leg.player)||0)+(S.baseballStat('runs',summary,feed,leg.team,leg.player)||0)+(S.baseballStat('rbi',summary,feed,leg.team,leg.player)||0)):0;st=milestone(n,target,game);break}
      case'player_points':{const n=started?(S.getPoints(summary,leg.team,leg.player)??0):0;st=milestone(n,target,game);break}
      case'player_rebounds':{const n=started?(S.getRebounds(summary,leg.team,leg.player)??0):0;st=milestone(n,target,game);break}
      case'player_assists':{const n=started?(S.getAssists(summary,leg.team,leg.player)??0):0;st=milestone(n,target,game);break}
      case'player_threes':{const n=started?(S.getThrees(summary,leg.team,leg.player)??0):0;st=milestone(n,target,game);break}
      case'player_blocks':{const n=started?(S.getBlocks(summary,leg.team,leg.player)??0):0;st=milestone(n,target,game);break}
      case'player_points_rebounds':case'player_pr':{const n=started?(S.getPoints(summary,leg.team,leg.player)||0)+(S.getRebounds(summary,leg.team,leg.player)||0):0;st=milestone(n,target,game);break}
      case'player_points_assists':case'player_pa':{const n=started?(S.getPoints(summary,leg.team,leg.player)||0)+(S.getAssists(summary,leg.team,leg.player)||0):0;st=milestone(n,target,game);break}
      case'player_rebounds_assists':case'player_ra':{const n=started?(S.getRebounds(summary,leg.team,leg.player)||0)+(S.getAssists(summary,leg.team,leg.player)||0):0;st=milestone(n,target,game);break}
      case'player_points_rebounds_assists':case'player_pra':{const n=started?(S.getPoints(summary,leg.team,leg.player)||0)+(S.getRebounds(summary,leg.team,leg.player)||0)+(S.getAssists(summary,leg.team,leg.player)||0):0;st=milestone(n,target,game);break}
      case'player_double_double':{const n=started?S.getDoubleCount(summary,leg.team,leg.player):0;st=milestone(n,2,game);break}
      case'player_triple_double':{const n=started?S.getDoubleCount(summary,leg.team,leg.player):0;st=milestone(n,3,game);break}
      default:st=C.statusObj('unavailable','UNSUPPORTED','valueSuspended');
    }
    return{...leg,__game:game,__live:st};
  }
  async function evaluateRecord(record,games){const source=record.ticket||{},ticket={...source,__recordReferenceTime:record.savedAt||record.createdAt||record.updatedAt||''};const legs=await Promise.all((source.legs||[]).map(leg=>evalLeg(ticket,leg,games)));return{...record,__evaluated:legs}}
  window.ParlayTrackerEvaluator={evaluateRecord};
})();
