import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {normalizeUiMode,storedUiMode,persistUiMode,calculateTrainingStreak,recordRows,UI_MODE_KEY} from '../public/pixel-ui.js';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');

function storage(value=null){return{value,getItem(key){assert.equal(key,UI_MODE_KEY);return this.value??value;},setItem(key,next){assert.equal(key,UI_MODE_KEY);this.value=next;}};}

test('UI mode defaults safely to Classic and persists only known modes',()=>{
  assert.equal(normalizeUiMode(undefined),'classic');
  assert.equal(normalizeUiMode('broken'),'classic');
  assert.equal(normalizeUiMode('pixel'),'pixel');
  assert.equal(storedUiMode(storage('broken')),'classic');
  const target=storage();
  assert.equal(persistUiMode('pixel',target),'pixel');
  assert.equal(target.value,'pixel');
  assert.equal(persistUiMode('unknown',target),'classic');
});

test('Pixel UI derives streaks and records deterministically from real rows',()=>{
  const rows=[
    {exercise_id:1,exercise_name:'A',new_weight:40,performed_at:'2026-08-21'},
    {exercise_id:1,exercise_name:'A',new_weight:45,performed_at:'2026-08-14'},
    {exercise_id:2,exercise_name:'B',new_weight:20,performed_at:'2026-08-07'},
    {exercise_id:2,exercise_name:'B',new_weight:25,performed_at:'2026-07-20'}
  ];
  assert.equal(calculateTrainingStreak(rows),3);
  assert.deepEqual(recordRows(rows).map(row=>[row.exercise_name,row.new_weight]),[['A',45],['B',25]]);
});

test('Pixel UI is loaded as an isolated optional presentation with early no-flash selection',()=>{
  const html=fs.readFileSync(path.join(root,'public','index.html'),'utf8');
  const css=fs.readFileSync(path.join(root,'public','styles-pixel.css'),'utf8');
  const app=fs.readFileSync(path.join(root,'public','app.js'),'utf8');
  assert.ok(html.indexOf("cresci-ui-mode")<html.indexOf('/styles.css'));
  assert.match(html,/styles-pixel\.css/);
  assert.match(html,/CRESCI Pixel UI <b>BETA<\/b>/);
  assert.match(css,/html:not\(\[data-ui="pixel"\]\) \.pixel-only\{display:none!important\}/);
  assert.match(css,/\[data-ui="pixel"\] #inventoryNav,\[data-ui="pixel"\] #shopNav\{display:none!important\}/);
  assert.match(app,/\/\/ PIXEL UI/);
  assert.doesNotMatch(fs.readFileSync(path.join(root,'public','pixel-ui.js'),'utf8'),/fetch\(/);
});
