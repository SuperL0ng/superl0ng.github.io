#!/usr/bin/env node
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const source=readFileSync(new URL('../show-legs-label-fix.js',import.meta.url),'utf8');
assert.match(source,/a\[href\*=["']#ticket=/);
assert.match(source,/stabilizeCardId/);
assert.match(source,/dataset\.ticketBindingFix/);
assert.match(source,/record=>record\.status!==['"]completed['"]/);
assert.match(source,/cardId&&byId\.get\(cardId\)/);
assert.doesNotMatch(source,/attributeFilter:\[['"]aria-expanded['"],['"]class['"]/);

const stored=[
  {id:'2000',status:'active'},
  {id:'1718',status:'active'},
  {id:'1043',status:'completed'},
  {id:'1969',status:'completed'}
];
const visible=['1043','1969','2000','1718'];
const byId=new Map(stored.map(record=>[record.id,record]));
assert.deepEqual(visible.map(id=>byId.get(id).id),visible);

const active=stored.filter(record=>record.status!=='completed');
const activeById=new Map(active.map(record=>[record.id,record]));
assert.deepEqual(['2000','1718'].map(id=>activeById.get(id).id),['2000','1718']);
assert.equal(activeById.has('1043'),false);
assert.equal(activeById.has('1969'),false);

console.log('Ticket-ID dashboard regression model passed.');
