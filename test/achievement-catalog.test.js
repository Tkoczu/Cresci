import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {achievementCatalog,ACHIEVEMENT_CATEGORIES,ACHIEVEMENT_METRICS,achievementProgress} from '../src/achievements.js';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const source=JSON.parse(fs.readFileSync(path.join(root,'public','content','achievements.json'),'utf8'));

test('managed achievement catalog accepts any valid active set without fixed names or counts',()=>{
  assert.ok(Array.isArray(source.items));
  const active=source.items.filter(item=>item.active!==false),keys=new Set();
  for(const item of active){
    assert.match(String(item.key||''),/^[a-z][a-z0-9_]{2,63}$/);
    assert.equal(keys.has(item.key),false,`duplicate achievement key: ${item.key}`);keys.add(item.key);
    assert.ok(ACHIEVEMENT_CATEGORIES[item.category],`${item.key}: unknown category`);
    assert.ok(ACHIEVEMENT_METRICS.has(item.metric),`${item.key}: unsupported metric`);
    assert.ok(Number.isInteger(item.target)&&item.target>=1,`${item.key}: invalid target`);
    assert.ok(Number.isInteger(item.rewardPr)&&item.rewardPr>=0,`${item.key}: invalid PR reward`);
  }
  assert.deepEqual(achievementCatalog().map(item=>item.key),active.map(item=>item.key));
});

test('every supported achievement metric is evaluated generically',()=>{
  for(const metric of ACHIEVEMENT_METRICS){
    const definition={metric,target:2};
    assert.equal(achievementProgress(definition,{[metric]:1}).complete,false,metric);
    assert.equal(achievementProgress(definition,{[metric]:2}).complete,true,metric);
  }
});
