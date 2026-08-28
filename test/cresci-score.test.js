import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateCresciScore } from '../src/cresci-score.js';

const entry=(id,user,exercise,date,weight)=>({id,profile_id:user,exercise_id:exercise,performed_at:date,new_weight:weight});

test('CRESCI Score is deterministic and maintenance is not zero strength',()=>{
  const entries=[entry(1,1,1,'2026-07-20',80),entry(2,1,1,'2026-08-05',80),entry(3,1,1,'2026-08-12',80),entry(4,1,1,'2026-08-19',80),entry(5,1,1,'2026-08-26',80)];
  const input={userId:1,userName:'Marek',weeklyGoal:1,entries,activeExerciseIds:[1],asOf:'2026-08-27'},a=calculateCresciScore(input),b=calculateCresciScore(input);
  assert.deepEqual(a,b);assert.equal(a.categories.strength.score,20);assert.ok(a.score>=20&&a.score<=100);
});

test('a single huge weight jump is capped before scoring',()=>{
  const entries=[entry(1,1,1,'2026-07-25',10),entry(2,1,1,'2026-08-10',1000),entry(3,1,2,'2026-07-25',100),entry(4,1,2,'2026-08-10',100)];
  const result=calculateCresciScore({userId:1,userName:'Marek',weeklyGoal:3,entries,activeExerciseIds:[1,2],asOf:'2026-08-27'});
  assert.equal(result.categories.strength.average_capped_change_percent,5);assert.equal(result.categories.strength.score,30);assert.ok(result.score<=100);
});

test('entries belonging to another user do not affect the score',()=>{
  const entries=[entry(1,1,1,'2026-08-01',50),entry(2,1,1,'2026-08-20',55),entry(3,2,1,'2026-08-01',50),entry(4,2,1,'2026-08-20',500)];
  const result=calculateCresciScore({userId:1,userName:'Marek',weeklyGoal:2,entries,activeExerciseIds:[1],asOf:'2026-08-27'});
  assert.equal(result.categories.strength.average_capped_change_percent,10);assert.equal(result.user_id,1);
});

test('no activity produces a transparent zero score',()=>{
  const result=calculateCresciScore({userId:1,userName:'Marek',weeklyGoal:3,entries:[],activeExerciseIds:[],asOf:'2026-08-27'});
  assert.equal(result.score,0);assert.match(result.explanation,/nie ma zapisanych treningów/);
});
