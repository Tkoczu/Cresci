import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { createRepository } from '../src/db.js';

function memoryRepo() {
  const db = new DatabaseSync(':memory:');
  db.exec(`PRAGMA foreign_keys=ON;
    CREATE TABLE profiles(id INTEGER PRIMARY KEY,name TEXT,color TEXT,created_at TEXT DEFAULT CURRENT_TIMESTAMP);
    CREATE TABLE exercises(id INTEGER PRIMARY KEY,name TEXT,category TEXT,load_mode TEXT,bar_weight REAL,step_size REAL,active INTEGER DEFAULT 1,created_at TEXT DEFAULT CURRENT_TIMESTAMP,updated_at TEXT DEFAULT CURRENT_TIMESTAMP);
    CREATE TABLE progress_entries(id INTEGER PRIMARY KEY,profile_id INTEGER REFERENCES profiles(id),exercise_id INTEGER REFERENCES exercises(id),performed_at TEXT,old_weight REAL,new_weight REAL,increment REAL,plates_or_steps TEXT,change_type TEXT,change_label TEXT NOT NULL DEFAULT '',note TEXT,created_at TEXT DEFAULT CURRENT_TIMESTAMP);
    CREATE TABLE score_settings(profile_id INTEGER PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,enabled INTEGER DEFAULT 0,weekly_goal INTEGER DEFAULT 3,updated_at TEXT DEFAULT CURRENT_TIMESTAMP);
    CREATE TABLE game_profiles(profile_id INTEGER PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,enabled INTEGER DEFAULT 0,avatar_configured INTEGER DEFAULT 0,avatar_gender TEXT,skin_tone TEXT,eye_color TEXT,hairstyle TEXT,hair_color TEXT,top_style TEXT DEFAULT 'cresci_tank',bottom_style TEXT DEFAULT 'training_shorts',shoes_style TEXT DEFAULT 'trainers',headwear TEXT DEFAULT 'none',accessory TEXT DEFAULT 'none',total_xp INTEGER DEFAULT 0,pr_balance INTEGER DEFAULT 0,pr_total_earned INTEGER DEFAULT 0,created_at TEXT DEFAULT CURRENT_TIMESTAMP,updated_at TEXT DEFAULT CURRENT_TIMESTAMP);
    CREATE TABLE game_events(id INTEGER PRIMARY KEY,profile_id INTEGER REFERENCES profiles(id) ON DELETE CASCADE,event_type TEXT,event_key TEXT,xp_delta INTEGER DEFAULT 0,pr_delta INTEGER DEFAULT 0,metadata_json TEXT DEFAULT '{}',occurred_at TEXT,created_at TEXT DEFAULT CURRENT_TIMESTAMP,UNIQUE(profile_id,event_type,event_key));
    CREATE TABLE game_records(profile_id INTEGER REFERENCES profiles(id) ON DELETE CASCADE,exercise_id INTEGER REFERENCES exercises(id) ON DELETE CASCADE,record_weight REAL,last_source_entry_id INTEGER,achieved_at TEXT,created_at TEXT DEFAULT CURRENT_TIMESTAMP,updated_at TEXT DEFAULT CURRENT_TIMESTAMP,PRIMARY KEY(profile_id,exercise_id));
    CREATE TABLE pr_transactions(id INTEGER PRIMARY KEY,profile_id INTEGER REFERENCES profiles(id) ON DELETE CASCADE,source_type TEXT,source_key TEXT,amount INTEGER,balance_after INTEGER,metadata_json TEXT DEFAULT '{}',created_at TEXT,UNIQUE(profile_id,source_type,source_key));
    CREATE TABLE user_achievements(profile_id INTEGER REFERENCES profiles(id) ON DELETE CASCADE,achievement_key TEXT,unlocked_at TEXT,reward_pr INTEGER DEFAULT 0,reward_item_key TEXT,reward_item_granted INTEGER DEFAULT 0,metadata_json TEXT DEFAULT '{}',PRIMARY KEY(profile_id,achievement_key));
    CREATE TABLE user_items(profile_id INTEGER REFERENCES profiles(id) ON DELETE CASCADE,item_key TEXT,acquired_source TEXT,acquired_at TEXT,purchased_price INTEGER DEFAULT 0,metadata_json TEXT DEFAULT '{}',PRIMARY KEY(profile_id,item_key));
    INSERT INTO profiles(id,name,color) VALUES(1,'Marek','#f00'),(2,'Domii','#70f');
    INSERT INTO exercises(id,name,category,load_mode,bar_weight,step_size) VALUES(1,'Przysiad','Nogi','plates',20,2.5);`);
  return { db, repo:createRepository(db) };
}

test('entry derives old weight, increment and change type', () => {
  const {db,repo}=memoryRepo();
  const first=repo.addEntry({profile_id:1,exercise_id:1,new_weight:80,performed_at:'2026-08-01'});
  const second=repo.addEntry({profile_id:1,exercise_id:1,new_weight:85,performed_at:'2026-08-08',plates_or_steps:'2 × 15 + 2 × 10'});
  assert.equal(first.change_type,'start'); assert.equal(first.old_weight,null);
  assert.equal(second.old_weight,80); assert.equal(second.increment,5); assert.equal(second.change_type,'increase');
  db.close();
});

test('profiles keep independent progress', () => {
  const {db,repo}=memoryRepo();
  repo.addEntry({profile_id:1,exercise_id:1,new_weight:90,performed_at:'2026-08-01'});
  repo.addEntry({profile_id:2,exercise_id:1,new_weight:55,performed_at:'2026-08-01'});
  assert.equal(repo.progress(1,1)[0].new_weight,90); assert.equal(repo.progress(2,1)[0].new_weight,55);
  db.close();
});

test('plate-only entry keeps the previous weight', () => {
  const {db,repo}=memoryRepo();
  repo.addEntry({profile_id:1,exercise_id:1,new_weight:80,performed_at:'2026-08-01',plates_or_steps:'2 × 15 kg'});
  const plateOnly=repo.addEntry({profile_id:1,exercise_id:1,new_weight:'',performed_at:'2026-08-08',plates_or_steps:'2 × 20 kg'});
  assert.equal(plateOnly.old_weight,80);assert.equal(plateOnly.new_weight,80);assert.equal(plateOnly.increment,0);assert.equal(plateOnly.change_type,'repeat');assert.equal(plateOnly.plates_or_steps,'2 × 20 kg');
  const dashboardExercise=repo.bootstrap().exercises.find(x=>x.id===1);
  assert.equal(dashboardExercise.marek_weight,80);assert.equal(dashboardExercise.marek_plates,'2 × 20 kg');
  db.close();
});

test('first entry still requires a weight', () => {
  const {db,repo}=memoryRepo();
  assert.throws(()=>repo.addEntry({profile_id:1,exercise_id:1,new_weight:'',performed_at:'2026-08-01',plates_or_steps:'stopień 4'}),/pierwszym wpisie/);
  db.close();
});

test('editing an entry recalculates later old weights and increments', () => {
  const {db,repo}=memoryRepo();
  repo.addEntry({profile_id:1,exercise_id:1,new_weight:80,performed_at:'2026-08-01',plates_or_steps:'2 × 15'});
  const middle=repo.addEntry({profile_id:1,exercise_id:1,new_weight:85,performed_at:'2026-08-08',plates_or_steps:'2 × 17.5'});
  repo.addEntry({profile_id:1,exercise_id:1,new_weight:90,performed_at:'2026-08-15',plates_or_steps:'2 × 20'});
  repo.updateEntry(middle.id,{new_weight:87,performed_at:'2026-08-08',plates_or_steps:'2 × 18.5',change_label:'Korekta',note:'poprawione'});
  const rows=repo.progress(1,1);
  assert.equal(rows[1].new_weight,87);assert.equal(rows[1].increment,7);
  assert.equal(rows[2].new_weight,90);assert.equal(rows[2].increment,3);
  const history=repo.history({profile_id:1,exercise_id:1});
  assert.equal(history.find(x=>x.id===middle.id).old_plates_or_steps,'2 × 15');
  db.close();
});

test('deleting an entry reconnects the surrounding progress chain', () => {
  const {db,repo}=memoryRepo();
  repo.addEntry({profile_id:1,exercise_id:1,new_weight:80,performed_at:'2026-08-01'});
  const middle=repo.addEntry({profile_id:1,exercise_id:1,new_weight:85,performed_at:'2026-08-08'});
  repo.addEntry({profile_id:1,exercise_id:1,new_weight:90,performed_at:'2026-08-15'});
  assert.equal(repo.deleteEntry(middle.id),true);
  const rows=repo.progress(1,1);assert.equal(rows.length,2);
  const newest=repo.history({profile_id:1,exercise_id:1})[0];assert.equal(newest.old_weight,80);assert.equal(newest.increment,10);
  db.close();
});

test('exercise without history is deleted permanently', () => {
  const {db,repo}=memoryRepo();
  const result=repo.deleteExercise(1);
  assert.equal(result.archived,false);assert.equal(repo.bootstrap().exercises.length,0);
  db.close();
});

test('exercise with history is hidden but its entries are preserved', () => {
  const {db,repo}=memoryRepo();
  repo.addEntry({profile_id:1,exercise_id:1,new_weight:80,performed_at:'2026-08-01'});
  const result=repo.deleteExercise(1);
  const bootstrap=repo.bootstrap(),history=repo.history();
  assert.equal(result.archived,true);assert.equal(result.history_entries,1);assert.equal(bootstrap.exercises.length,0);assert.equal(bootstrap.archived_exercises.length,1);assert.equal(history.length,1);assert.equal(history[0].exercise_active,0);
  db.close();
});

test('export/import round trip restores all entries', () => {
  const a=memoryRepo();a.repo.addEntry({profile_id:1,exercise_id:1,new_weight:100,performed_at:'2026-08-20'});a.repo.updateScoreSettings(1,{enabled:true,weekly_goal:4});const backup=a.repo.exportData();
  const b=memoryRepo();const result=b.repo.importData(backup);
  assert.equal(result.entries,1);assert.equal(b.repo.history().length,1);assert.equal(b.repo.history()[0].new_weight,100);assert.equal(b.repo.scoreSettings().find(item=>item.user_id===1).weekly_goal,4);assert.equal(b.repo.scoreSettings().find(item=>item.user_id===1).enabled,1);
  a.db.close();b.db.close();
});

test('older backups without Score settings remain compatible',()=>{
  const a=memoryRepo(),backup=a.repo.exportData();delete backup.score_settings;
  const b=memoryRepo();b.repo.updateScoreSettings(1,{enabled:true,weekly_goal:7});b.repo.importData(backup);
  const setting=b.repo.scoreSettings().find(item=>item.user_id===1);assert.equal(setting.enabled,0);assert.equal(setting.weekly_goal,3);
  a.db.close();b.db.close();
});

test('overall index normalizes exercises to their own baseline', () => {
  const {db,repo}=memoryRepo();
  db.prepare(`INSERT INTO exercises(id,name,category,load_mode,bar_weight,step_size) VALUES(2,'Wyciskanie','Klatka','plates',20,2.5)`).run();
  repo.addEntry({profile_id:1,exercise_id:1,new_weight:100,performed_at:'2026-08-01'});
  repo.addEntry({profile_id:1,exercise_id:2,new_weight:50,performed_at:'2026-08-01'});
  repo.addEntry({profile_id:1,exercise_id:1,new_weight:110,performed_at:'2026-08-08'});
  repo.addEntry({profile_id:1,exercise_id:2,new_weight:60,performed_at:'2026-08-08'});
  const points=repo.overallProgress(1);
  assert.equal(points[0].index_value,100);
  assert.equal(points[1].index_value,115);
  assert.equal(points[1].exercise_count,2);
  db.close();
});

test('CRESCI Score settings are disabled by default and isolated per user_id',()=>{
  const{db,repo}=memoryRepo();
  assert.equal(repo.scoreSettings().every(item=>item.enabled===0),true);
  repo.updateScoreSettings(1,{enabled:true,weekly_goal:3});
  repo.addEntry({profile_id:1,exercise_id:1,new_weight:80,performed_at:'2026-08-01'});
  repo.addEntry({profile_id:1,exercise_id:1,new_weight:85,performed_at:'2026-08-20'});
  const scores=repo.cresciScores('2026-08-27');
  assert.equal(scores.length,1);assert.equal(scores[0].user_id,1);assert.equal(repo.scoreSettings().find(item=>item.user_id===2).enabled,0);
  db.close();
});

const avatar={gender:'male',skin_tone:'warm',eye_color:'green',hairstyle:'short',hair_color:'brown',top_style:'cresci_tank',bottom_style:'training_shorts',shoes_style:'trainers',headwear:'none',accessory:'wrist_wraps'};

test('CRESCI GAME is off by default and requires an avatar on first enable',()=>{
  const{db,repo}=memoryRepo();
  assert.equal(repo.gameSettings().every(item=>item.enabled===0),true);
  assert.throws(()=>repo.updateGameSettings(1,{enabled:true}),/avatar/);
  const setting=repo.updateGameSettings(1,{enabled:true,avatar});
  assert.equal(setting.enabled,1);assert.equal(setting.avatar_configured,1);assert.equal(setting.gender,'male');
  assert.equal(repo.gameSettings().find(item=>item.user_id===2).enabled,0);
  db.close();
});

test('check-in grants XP once per day and remains isolated per user_id',()=>{
  const{db,repo}=memoryRepo();
  repo.updateGameSettings(1,{enabled:true,avatar});
  const result=repo.gameCheckIn(1,'2026-08-27');
  assert.equal(result.total_xp,25);assert.equal(result.current_xp,25);assert.equal(result.checked_in_today,true);
  assert.equal(repo.gameSettings().find(item=>item.user_id===2).total_xp,0);
  assert.throws(()=>repo.gameCheckIn(1,'2026-08-27'),/już zapisany/);
  db.close();
});

test('GAME state and event ledger survive backup round trip',()=>{
  const a=memoryRepo();a.repo.updateGameSettings(1,{enabled:true,avatar});a.repo.gameCheckIn(1,'2026-08-27');const backup=a.repo.exportData();
  const b=memoryRepo();b.repo.importData(backup);const state=b.repo.gameStates('2026-08-27')[0];
  assert.equal(state.user_id,1);assert.equal(state.total_xp,25);assert.equal(state.checked_in_today,true);assert.equal(state.pr_balance,1);assert.equal(backup.game_events.length,1);assert.equal(backup.user_achievements.length,1);
  a.db.close();b.db.close();
});

test('older backups without GAME data remain compatible',()=>{
  const a=memoryRepo(),backup=a.repo.exportData();delete backup.game_profiles;delete backup.game_events;delete backup.game_records;
  const b=memoryRepo();b.repo.updateGameSettings(1,{enabled:true,avatar});b.repo.importData(backup);
  assert.equal(b.repo.gameSettings().every(item=>item.enabled===0),true);
  a.db.close();b.db.close();
});

test('first result establishes a baseline and only a real higher record earns PR',()=>{
  const{db,repo}=memoryRepo();repo.updateGameSettings(1,{enabled:true,avatar});
  const first=repo.addEntry({profile_id:1,exercise_id:1,new_weight:80,performed_at:'2026-08-01'});
  const record=repo.addEntry({profile_id:1,exercise_id:1,new_weight:85,performed_at:'2026-08-08'});
  const repeat=repo.addEntry({profile_id:1,exercise_id:1,new_weight:85,performed_at:'2026-08-15'});
  const lower=repo.addEntry({profile_id:1,exercise_id:1,new_weight:82,performed_at:'2026-08-22'});
  const game=repo.gameSettings().find(item=>item.user_id===1);
  assert.equal(first.pr_awarded,0);assert.equal(first.is_personal_record,false);assert.equal(record.pr_awarded,1);assert.equal(record.previous_record,80);assert.equal(repeat.pr_awarded,0);assert.equal(lower.pr_awarded,0);
  assert.equal(game.pr_balance,2);assert.equal(game.pr_total_earned,2);assert.equal(repo.gameRecords(1)[0].record_weight,85);
  assert.equal(db.prepare("SELECT COUNT(*) AS count FROM game_events WHERE event_type='personal_record'").get().count,1);
  assert.deepEqual(db.prepare('SELECT source_type FROM pr_transactions ORDER BY id').all().map(row=>row.source_type),['RECORD','ACHIEVEMENT']);
  db.close();
});

test('GAME OFF advances the protected record but awards no PR and users remain isolated',()=>{
  const{db,repo}=memoryRepo();
  repo.addEntry({profile_id:2,exercise_id:1,new_weight:50,performed_at:'2026-08-01'});
  const offRecord=repo.addEntry({profile_id:2,exercise_id:1,new_weight:60,performed_at:'2026-08-08'});
  assert.equal(offRecord.pr_awarded,0);assert.equal(repo.gameRecords(2)[0].record_weight,60);
  repo.updateGameSettings(2,{enabled:true,avatar:{...avatar,gender:'female'}});
  assert.equal(repo.addEntry({profile_id:2,exercise_id:1,new_weight:60,performed_at:'2026-08-15'}).pr_awarded,0);
  assert.equal(repo.addEntry({profile_id:2,exercise_id:1,new_weight:61,performed_at:'2026-08-22'}).pr_awarded,1);
  assert.equal(repo.gameSettings().find(item=>item.user_id===2).pr_balance,2);assert.equal(repo.gameSettings().find(item=>item.user_id===1).pr_balance,0);
  db.close();
});

test('editing, deleting and re-adding cannot farm the same PR',()=>{
  const{db,repo}=memoryRepo();repo.updateGameSettings(1,{enabled:true,avatar});
  repo.addEntry({profile_id:1,exercise_id:1,new_weight:80,performed_at:'2026-08-01'});
  const earned=repo.addEntry({profile_id:1,exercise_id:1,new_weight:85,performed_at:'2026-08-08'});assert.equal(earned.pr_awarded,1);
  repo.updateEntry(earned.id,{new_weight:90,performed_at:'2026-08-08'});
  assert.equal(repo.gameSettings().find(item=>item.user_id===1).pr_total_earned,2);assert.equal(repo.gameRecords(1)[0].record_weight,90);
  repo.deleteEntry(earned.id);
  assert.equal(repo.addEntry({profile_id:1,exercise_id:1,new_weight:90,performed_at:'2026-08-15'}).pr_awarded,0);
  const next=repo.addEntry({profile_id:1,exercise_id:1,new_weight:91,performed_at:'2026-08-22'});assert.equal(next.pr_awarded,1);
  repo.updateEntry(next.id,{new_weight:70,performed_at:'2026-08-22'});repo.deleteEntry(next.id);
  assert.equal(repo.addEntry({profile_id:1,exercise_id:1,new_weight:91,performed_at:'2026-08-29'}).pr_awarded,0);
  const game=repo.gameSettings().find(item=>item.user_id===1);assert.equal(game.pr_balance,3);assert.equal(game.pr_total_earned,3);assert.equal(repo.gameRecords(1)[0].record_weight,91);
  db.close();
});

test('backup preserves a deleted high-water record and prevents duplicate PR after restore',()=>{
  const a=memoryRepo();a.repo.updateGameSettings(1,{enabled:true,avatar});a.repo.addEntry({profile_id:1,exercise_id:1,new_weight:80,performed_at:'2026-08-01'});const earned=a.repo.addEntry({profile_id:1,exercise_id:1,new_weight:90,performed_at:'2026-08-08'});a.repo.deleteEntry(earned.id);const backup=a.repo.exportData();
  const b=memoryRepo();b.repo.importData(backup);const repeated=b.repo.addEntry({profile_id:1,exercise_id:1,new_weight:90,performed_at:'2026-08-15'});
  assert.equal(repeated.pr_awarded,0);assert.equal(b.repo.gameSettings().find(item=>item.user_id===1).pr_total_earned,2);assert.equal(b.repo.gameRecords(1)[0].record_weight,90);
  a.db.close();b.db.close();
});

test('GAME backups from before layered outfits receive visual defaults',()=>{
  const a=memoryRepo();a.repo.updateGameSettings(1,{enabled:true,avatar});const backup=a.repo.exportData();
  for(const profile of backup.game_profiles)for(const field of ['top_style','bottom_style','shoes_style','headwear','accessory'])delete profile[field];
  const b=memoryRepo();b.repo.importData(backup);const restored=b.repo.gameSettings().find(item=>item.user_id===1);
  assert.equal(restored.top_style,'cresci_tank');assert.equal(restored.bottom_style,'training_shorts');assert.equal(restored.shoes_style,'trainers');assert.equal(restored.headwear,'none');assert.equal(restored.accessory,'none');
  a.db.close();b.db.close();
});

test('achievements unlock once, save their date and reward PR through a separate source',()=>{
  const{db,repo}=memoryRepo();repo.updateGameSettings(1,{enabled:true,avatar});
  const first=repo.gameCheckIn(1,'2026-08-01',{local_hour:12,occurred_at:'2026-08-01T10:00:00.000Z'});
  assert.deepEqual(first.unlocked_achievements.map(item=>item.key),['first_step']);
  const unlocked=db.prepare("SELECT * FROM user_achievements WHERE profile_id=1 AND achievement_key='first_step'").get();
  assert.equal(unlocked.unlocked_at,'2026-08-01T10:00:00.000Z');assert.equal(unlocked.reward_pr,1);assert.equal(unlocked.reward_item_key,null);
  assert.equal(db.prepare("SELECT COUNT(*) AS count FROM pr_transactions WHERE source_type='ACHIEVEMENT' AND source_key='first_step'").get().count,1);
  assert.throws(()=>repo.gameCheckIn(1,'2026-08-01',{local_hour:12}),/już zapisany/);
  assert.equal(repo.gameSettings().find(item=>item.user_id===1).pr_balance,1);
  db.close();
});

test('GAME OFF never grants achievements',()=>{
  const{db,repo}=memoryRepo();
  assert.deepEqual(repo.recordGameAction(1,'view_progress_chart').unlocked_achievements,[]);
  repo.addExercise({name:'Własne OFF',category:'Inne',load_mode:'direct',origin:'custom',creator_user_id:1});
  assert.equal(db.prepare('SELECT COUNT(*) AS count FROM user_achievements').get().count,0);
  db.close();
});

test('record achievements count only RECORD events and cannot loop from achievement PR',()=>{
  const{db,repo}=memoryRepo();repo.updateGameSettings(1,{enabled:true,avatar});
  repo.addEntry({profile_id:1,exercise_id:1,new_weight:80,performed_at:'2026-08-01'});
  const result=repo.addEntry({profile_id:1,exercise_id:1,new_weight:85,performed_at:'2026-08-08'});
  assert.deepEqual(result.unlocked_achievements.map(item=>item.key),['level_up']);
  assert.equal(repo.achievements(1).items.find(item=>item.key==='stronger_than_yesterday').progress.value,1);
  assert.equal(db.prepare("SELECT COUNT(*) AS count FROM pr_transactions WHERE source_type='RECORD'").get().count,1);
  assert.equal(db.prepare("SELECT COUNT(*) AS count FROM pr_transactions WHERE source_type='ACHIEVEMENT'").get().count,1);
  db.close();
});

test('hidden achievements stay masked until their condition is met',()=>{
  const{db,repo}=memoryRepo();repo.updateGameSettings(1,{enabled:true,avatar});
  let hidden=repo.achievements(1).items.find(item=>item.key==='night_warrior');assert.equal(hidden.name,'???');assert.equal(hidden.progress,null);
  const result=repo.gameCheckIn(1,'2026-08-02',{local_hour:23,occurred_at:'2026-08-02T21:15:00.000Z'});
  assert.equal(result.unlocked_achievements.some(item=>item.key==='night_warrior'),true);
  hidden=repo.achievements(1).items.find(item=>item.key==='night_warrior');assert.equal(hidden.name,'Nocny wojownik');assert.equal(hidden.unlocked,true);
  db.close();
});

test('weekly goal streak uses consecutive completed calendar weeks',()=>{
  const{db,repo}=memoryRepo();repo.updateGameSettings(1,{enabled:true,avatar});repo.updateScoreSettings(1,{enabled:false,weekly_goal:3});
  for(const date of ['2026-08-03','2026-08-04','2026-08-05','2026-08-10','2026-08-11','2026-08-12'])repo.gameCheckIn(1,date,{local_hour:12,occurred_at:`${date}T10:00:00.000Z`});
  const onFire=repo.achievements(1).items.find(item=>item.key==='on_fire');assert.equal(onFire.unlocked,true);assert.equal(onFire.progress.value,2);
  db.close();
});

test('custom exercise and first chart view unlock exploration achievements once',()=>{
  const{db,repo}=memoryRepo();repo.updateGameSettings(1,{enabled:true,avatar});
  const exercise=repo.addExercise({name:'Moje ćwiczenie',category:'Inne',load_mode:'direct',origin:'custom',creator_user_id:1});
  assert.deepEqual(exercise.unlocked_achievements.map(item=>item.key),['experimenter']);
  const chart=repo.recordGameAction(1,'view_progress_chart');assert.deepEqual(chart.unlocked_achievements.map(item=>item.key),['analyst']);
  assert.equal(repo.recordGameAction(1,'view_progress_chart').recorded,false);
  assert.equal(db.prepare("SELECT COUNT(*) AS count FROM user_achievements WHERE achievement_key IN ('experimenter','analyst')").get().count,2);
  db.close();
});

test('achievement and PR ledgers survive backup round trip',()=>{
  const a=memoryRepo();a.repo.updateGameSettings(1,{enabled:true,avatar});a.repo.gameCheckIn(1,'2026-08-01',{local_hour:12});const backup=a.repo.exportData();
  const b=memoryRepo();b.repo.importData(backup);
  assert.equal(b.repo.achievements(1).items.find(item=>item.key==='first_step').unlocked,true);
  assert.equal(b.db.prepare("SELECT COUNT(*) AS count FROM pr_transactions WHERE source_type='ACHIEVEMENT'").get().count,1);
  assert.equal(b.repo.gameSettings().find(item=>item.user_id===1).pr_balance,1);
  a.db.close();b.db.close();
});

test('shop purchase charges PR once, adds inventory and unlocks item achievements',()=>{
  const{db,repo}=memoryRepo();repo.updateGameSettings(1,{enabled:true,avatar});
  db.prepare('UPDATE game_profiles SET pr_balance=20 WHERE profile_id=1').run();
  const result=repo.purchaseItem(1,'headband');
  assert.equal(result.item.owned,true);assert.equal(result.inventory.items.some(item=>item.key==='headband'),true);
  assert.deepEqual(result.unlocked_achievements.map(item=>item.key),['collector','first_purchase']);
  assert.equal(repo.gameSettings().find(item=>item.user_id===1).pr_balance,20);
  assert.deepEqual(db.prepare("SELECT source_type,amount FROM pr_transactions WHERE source_type IN ('SHOP_PURCHASE','ACHIEVEMENT') ORDER BY id").all().map(row=>[row.source_type,row.amount]),[
    ['SHOP_PURCHASE',-2],['ACHIEVEMENT',1],['ACHIEVEMENT',1]
  ]);
  assert.throws(()=>repo.purchaseItem(1,'headband'),/już w ekwipunku/);
  db.close();
});

test('equip persists per user, updates avatar layer and can be removed',()=>{
  const{db,repo}=memoryRepo();repo.updateGameSettings(1,{enabled:true,avatar});db.prepare('UPDATE game_profiles SET pr_balance=20 WHERE profile_id=1').run();repo.purchaseItem(1,'headband');
  const equipped=repo.equipItem(1,'headwear','headband');
  assert.equal(equipped.game.headwear,'headband');assert.equal(equipped.inventory.items.find(item=>item.key==='headband').equipped,true);
  assert.equal(equipped.unlocked_achievements.some(item=>item.key==='full_equipment'),true);
  assert.equal(repo.gameStates()[0].headwear,'headband');
  const editedBase=repo.updateGameSettings(1,{enabled:true,avatar:{...avatar,eye_color:'blue',headwear:'headband'}});assert.equal(editedBase.eye_color,'blue');assert.equal(editedBase.headwear,'headband');
  const removed=repo.equipItem(1,'headwear',null);assert.equal(removed.game.headwear,'none');assert.equal(removed.inventory.items.find(item=>item.key==='headband').equipped,false);
  assert.equal(repo.achievements(1).items.find(item=>item.key==='full_equipment').unlocked,true);
  db.close();
});

test('shop blocks GAME OFF, insufficient balance and wrong-slot equip',()=>{
  const{db,repo}=memoryRepo();assert.throws(()=>repo.purchaseItem(1,'headband'),/nie jest włączony/);
  repo.updateGameSettings(1,{enabled:true,avatar});assert.throws(()=>repo.purchaseItem(1,'headband'),/Brakuje 2 PR/);
  db.prepare('UPDATE game_profiles SET pr_balance=5 WHERE profile_id=1').run();repo.purchaseItem(1,'headband');
  assert.throws(()=>repo.equipItem(1,'top','headband'),/nie pasuje/);assert.throws(()=>repo.equipItem(1,'headwear','beanie'),/Najpierw zdobądź/);
  db.close();
});

test('inventory and purchases survive backup round trip',()=>{
  const a=memoryRepo();a.repo.updateGameSettings(1,{enabled:true,avatar});a.db.prepare('UPDATE game_profiles SET pr_balance=20 WHERE profile_id=1').run();a.repo.purchaseItem(1,'headband');a.repo.equipItem(1,'headwear','headband');const backup=a.repo.exportData();
  const b=memoryRepo();b.repo.importData(backup);const inventory=b.repo.inventory(1);
  assert.equal(inventory.items.find(item=>item.key==='headband').equipped,true);assert.equal(b.repo.gameStates()[0].headwear,'headband');assert.equal(backup.user_items.length>=5,true);
  a.db.close();b.db.close();
});
