import test from 'node:test';
import assert from 'node:assert/strict';
import { collect, resolveCrash, resetEncounter, roomAt, furniture, gaps } from './rules.ts';
test('jamón awards points only once, including after a checkpoint return',()=>{const ids=new Set<number>();assert.equal(collect(12,ids),10);assert.equal(collect(12,ids),0);assert.equal(collect(13,ids),10);});
test('Bomboniel needs exactly three stool crashes',()=>{assert.deepEqual(resolveCrash(0),{count:1,state:'dizzy'});assert.deepEqual(resolveCrash(1),{count:2,state:'dizzy'});assert.deepEqual(resolveCrash(2),{count:3,state:'defeated'});assert.equal(resolveCrash(3).count,3);});
test('falling resets the encounter rather than keeping partial victory',()=>{assert.deepEqual(resetEncounter(),{state:'chase',crashes:0});});
test('room boundaries match the house chapter',()=>{assert.equal(roomAt(4799),'THE LIVING ROOM');assert.equal(roomAt(4800),'THE HALLWAY');assert.equal(roomAt(9600),'THE KITCHEN');});
test('stairs are jumpable and never hidden inside a furniture collision body',()=>{for(const [a,b] of gaps){assert.ok(b-a<200);assert.ok(!furniture.some(f=>f.x<b&&f.x+f.w>a));}});
