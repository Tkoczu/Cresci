import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {normalizeUiMode,storedUiMode,persistUiMode,calculateTrainingStreak,recordRows,pixelCharacterMarkup,UI_MODE_KEY} from '../public/pixel-ui.js';

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
  assert.match(css,/\[data-ui="pixel"\] #inventoryNav,\[data-ui="pixel"\] #shopNav\{display:block!important\}/);
  assert.match(css,/\[data-ui="pixel"\] \.topbar\{[^}]*width:calc\(100% \+ 276px\)[^}]*margin-left:-276px/);
  assert.match(css,/\[data-ui="pixel"\] \.brand \.brand-mark\{[^}]*border:0[^}]*image-rendering:auto/);
  assert.match(css,/\.brand \.brand-mark\{[^}]*clip-path:inset\(8\.5% round 20%\)[^}]*transform:scale\(1\.16\)/);
  assert.doesNotMatch(css,/\.brand \.brand-mark\{[^}]*image-rendering:pixelated/);
  assert.match(css,/\[data-ui="pixel"\] #dashboardView \.pixel-page-title,\[data-ui="pixel"\] #dashboardView \.pixel-stat-grid\{display:none!important\}/);
  assert.match(app,/\/\/ PIXEL UI/);
  assert.doesNotMatch(fs.readFileSync(path.join(root,'public','pixel-ui.js'),'utf8'),/fetch\(/);
  assert.doesNotMatch(html,/pixelReturnClassic|pixel-return-classic/);
  const hudMarkup=app.match(/function pixelHudMarkup\(game\)\{([\s\S]*?)\n\}/)?.[1]||'';
  assert.doesNotMatch(hudMarkup,/<span>Seria<\/span>/);
  const dashboardLists=app.match(/const recent=historyRows\.slice\(0,4\);([\s\S]*?)if\(game\)/)?.[1]||'';
  assert.doesNotMatch(dashboardLists,/dateFmt\(row\.performed_at\)/);
});

test('Pixel character scene hides the technical sprite checkerboard',()=>{
  const css=fs.readFileSync(path.join(root,'public','styles-pixel.css'),'utf8');
  assert.match(css,/\.pixel-avatar-scene \.sprite-stage\{[^}]*background-color:transparent;[^}]*background-image:none;/);
  assert.match(css,/\[data-ui="pixel"\] \.sprite-stage\{[^}]*background-color:transparent;[^}]*background-image:none;/);
  assert.match(css,/\.pixel-avatar-main\{[^}]*width:min\(250px,66%\)!important/);
  assert.match(css,/\.pixel-character-layout\{[^}]*grid-template-columns:minmax\(520px,1\.05fr\) minmax\(420px,\.95fr\)/);
});

test('Pixel character exposes symmetric clothing and appearance slots without a fake platform',()=>{
  const markup=pixelCharacterMarkup({user_id:7,user_name:'Marek',color:'#ff7410',level:2,required_xp:125,current_xp:0,total_xp:100,pr_balance:0,pr_total_earned:4,progress_percent:0,checked_in_today:false,check_in_xp:25},{escape:String,spriteAvatar:()=>'<div class="avatar"></div>',slotSource:()=>null});
  for(const slot of ['headwear','top','bottom','shoes','back','accessories','hair','eyes'])assert.match(markup,new RegExp(`data-equipment-slot="${slot}"`));
  assert.doesNotMatch(markup,/pixel-avatar-platform/);
  assert.match(markup,/data-equipment-user="7"/);
});

test('game screens use the main navigation without duplicate submenus',()=>{
  const html=fs.readFileSync(path.join(root,'public','index.html'),'utf8');
  const app=fs.readFileSync(path.join(root,'public','app.js'),'utf8');
  for(const id of ['characterView','inventoryView','shopView','achievementsView']){
    const markup=html.match(new RegExp(`<section class="view" id="${id}">([\\s\\S]*?)<\\/section>`))?.[1]||'';
    assert.doesNotMatch(markup,/class="game-nav"/);
  }
  assert.match(html,/<input type="hidden" id="achievementProfile">/);
  assert.match(html,/<input type="hidden" id="inventoryProfile">/);
  assert.match(html,/<input type="hidden" id="shopProfile">/);
  assert.doesNotMatch(html,/Profil osiągnięć/);
  assert.doesNotMatch(html,/Profil (?:ekwipunku|sklepu)/);
  assert.match(app,/for\(const id of \['achievementProfile','inventoryProfile','shopProfile'\]\)\$\(`#\$\{id\}`\)\.value=String\(enabledRows\[0\]\?\.user_id\|\|''\)/);
  assert.doesNotMatch(app,/inventoryBalance'\)\.innerHTML=`<span>\$\{esc\(result\.user_name\)\}/);
  assert.doesNotMatch(app,/shopBalance'\)\.innerHTML=`<span>\$\{esc\(result\.user_name\)\}/);
  assert.doesNotMatch(app,/const groups=\[\.\.\.new Set\(result\.items\.map\(item=>item\.category\)\)\]/);
  assert.match(app,/achievementGroups'\)\.innerHTML=`<div class="achievement-grid">\$\{result\.items\.map/);
  assert.doesNotMatch(app,/achievementSummary'\)\.innerHTML=`<div><span/);
});
