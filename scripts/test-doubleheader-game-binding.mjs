#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

globalThis.window=globalThis;
vm.runInThisContext(readFileSync(new URL('../tracker-core-v51.js',import.meta.url),'utf8'),{filename:'tracker-core-v51.js'});

const C=globalThis.ParlayTrackerCore;
const competitor=(abbr,score='0')=>({team:{abbreviation:abbr},score});
const game=(id,date,state,completed=false)=>({
  id:String(id),
  date,
  __sport:'mlb',
  status:{type:{state,completed,detail:completed?'Final':'Scheduled'}},
  competitions:[{competitors:[competitor('TB'),competitor('BOS')]}]
});

const first=game('game-1','2026-07-17T17:36:00Z','post',true);
const second=game('game-2','2026-07-17T23:10:00Z','pre',false);
const games=[first,second];
const base={date:'20260717',league:'MLB',game:'TB@BOS'};
const assert=(condition,message)=>{if(!condition)throw new Error(message)};

assert(C.findGame(games,'TB@BOS',base,{})===first,'A final Game 1 must not switch to upcoming Game 2');
assert(C.findGame(games,'TB@BOS',{...base,gameId:'game-2'}, {})===second,'Explicit event ID must select Game 2');
assert(C.findGame(games,'TB@BOS',{...base,gameNumber:2}, {})===second,'Doubleheader ordinal must select Game 2');
assert(C.findGame(games,'TB@BOS',{...base,gameStart:C.gameStartCT(second)}, {})===second,'Scheduled start must select Game 2');
assert(C.findGame(games,'TB@BOS',{...base,__recordReferenceTime:'2026-07-17T17:00:00Z'}, {})===first,'Legacy ticket saved near Game 1 must remain on Game 1');
assert(C.findGame(games,'TB@BOS',{...base,__recordReferenceTime:'2026-07-17T22:45:00Z'}, {})===second,'Legacy ticket saved near Game 2 must bind to Game 2');

console.log('MLB doubleheader game binding regression verified.');
