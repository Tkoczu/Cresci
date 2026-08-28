import test from 'node:test';
import assert from 'node:assert/strict';
import { clearCatalogCache, mapWgerExercise, searchWgerExercises } from '../src/exercise-catalog.js';

test('maps wger category, muscles, equipment and load mode to CRESCI fields', () => {
  const result = mapWgerExercise({
    id: 42, category:{ name:'Chest' },
    muscles:[{ name_en:'Chest' }], muscles_secondary:[{ name_en:'Triceps' }],
    equipment:[{ name:'Barbell' }]
  }, { name:'Bench Press' });
  assert.deepEqual(result, {
    source:'wger', source_id:42, name:'Bench Press', category:'Klatka piersiowa',
    muscles:['Chest','Triceps'], equipment:['Barbell'], load_mode:'plates'
  });
});

test('searches the downloaded name index and only fetches matching details', async () => {
  clearCatalogCache();
  const calls=[];
  const fetchImpl=async url=>{
    calls.push(url);
    if(url.includes('exercise-translation')) return { ok:true, json:async()=>({results:[
      {name:'Bench Press',exercise:12},{name:'Incline Bench Press',exercise:13},{name:'Squat',exercise:14}
    ]}) };
    return { ok:true, json:async()=>({id:Number(url.match(/(\d+)\/$/)[1]),category:{name:'Chest'},muscles:[],muscles_secondary:[],equipment:[]}) };
  };
  const results=await searchWgerExercises('bench',{fetchImpl});
  assert.deepEqual(results.map(item=>item.name),['Bench Press','Incline Bench Press']);
  assert.equal(calls.length,3);
});
