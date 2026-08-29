import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import { calculateCresciScore } from './cresci-score.js';
import { CHECK_IN_XP, levelFromXp, validateAvatar } from './cresci-game.js';
import { ACHIEVEMENTS, ACHIEVEMENT_CATEGORIES, achievementProgress, longestCompletedWeeklyStreak } from './achievements.js';
import { GAME_ITEMS, ITEM_SLOTS, SLOT_LABELS, RARITY_LABELS, avatarFieldForSlot, avatarItems, gameItem } from './game-items.js';

export const SCHEMA_VERSION = 9;

const seedExercises = [
  ['Wyciskanie sztangi leżąc', 'Klatka piersiowa', 'plates', 20, 1.25],
  ['Wyciskanie hantli skos dodatni', 'Klatka piersiowa', 'direct', 0, 2],
  ['Ściąganie drążka do klatki', 'Plecy', 'steps', 0, 5],
  ['Wiosłowanie siedząc', 'Plecy', 'steps', 0, 5],
  ['Wyciskanie nad głowę', 'Barki', 'plates', 20, 1.25],
  ['Unoszenie hantli bokiem', 'Barki', 'direct', 0, 1],
  ['Uginanie ramion z hantlami', 'Biceps', 'direct', 0, 1],
  ['Prostowanie ramion na wyciągu', 'Triceps', 'steps', 0, 2.5],
  ['Przysiad ze sztangą', 'Nogi', 'plates', 20, 2.5],
  ['Suwnica', 'Nogi', 'plates', 0, 5],
  ['Uginanie nóg leżąc', 'Nogi', 'steps', 0, 5],
  ['Wspięcia na palce', 'Łydki', 'steps', 0, 5]
];

function runMigrations(db) {
  db.exec(`
    PRAGMA foreign_keys = ON;
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS schema_meta (
      version INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS profiles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      color TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS exercises (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE COLLATE NOCASE,
      category TEXT NOT NULL DEFAULT 'Inne',
      load_mode TEXT NOT NULL DEFAULT 'direct' CHECK(load_mode IN ('direct','plates','steps')),
      bar_weight REAL NOT NULL DEFAULT 0 CHECK(bar_weight >= 0),
      step_size REAL NOT NULL DEFAULT 1 CHECK(step_size > 0),
      active INTEGER NOT NULL DEFAULT 1 CHECK(active IN (0,1)),
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS progress_entries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      profile_id INTEGER NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
      exercise_id INTEGER NOT NULL REFERENCES exercises(id) ON DELETE RESTRICT,
      performed_at TEXT NOT NULL,
      old_weight REAL,
      new_weight REAL NOT NULL CHECK(new_weight >= 0),
      increment REAL NOT NULL,
      plates_or_steps TEXT,
      change_type TEXT NOT NULL CHECK(change_type IN ('start','increase','decrease','repeat')),
      change_label TEXT NOT NULL DEFAULT '',
      note TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_entries_profile_exercise_date
      ON progress_entries(profile_id, exercise_id, performed_at DESC, id DESC);
    CREATE INDEX IF NOT EXISTS idx_entries_date
      ON progress_entries(performed_at DESC, id DESC);
  `);
  const version = db.prepare('SELECT version FROM schema_meta LIMIT 1').get();
  if (!version) db.prepare('INSERT INTO schema_meta(version) VALUES (1)').run();
  const currentVersion = version?.version ?? 1;
  if (currentVersion < 2) {
    const columns = db.prepare('PRAGMA table_info(progress_entries)').all().map(column => column.name);
    if (!columns.includes('change_label')) db.exec("ALTER TABLE progress_entries ADD COLUMN change_label TEXT NOT NULL DEFAULT ''");
    db.prepare('UPDATE schema_meta SET version=?').run(2);
  }
  if (currentVersion < 3) {
    db.exec(`CREATE TABLE IF NOT EXISTS score_settings (
      profile_id INTEGER PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
      enabled INTEGER NOT NULL DEFAULT 0 CHECK(enabled IN (0,1)),
      weekly_goal INTEGER NOT NULL DEFAULT 3 CHECK(weekly_goal BETWEEN 1 AND 7),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )`);
    db.prepare('UPDATE schema_meta SET version=?').run(3);
  }
  if (currentVersion < 4) {
    db.exec(`
      CREATE TABLE IF NOT EXISTS game_profiles (
        profile_id INTEGER PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
        enabled INTEGER NOT NULL DEFAULT 0 CHECK(enabled IN (0,1)),
        avatar_configured INTEGER NOT NULL DEFAULT 0 CHECK(avatar_configured IN (0,1)),
        avatar_gender TEXT,
        skin_tone TEXT,
        eye_color TEXT,
        hairstyle TEXT,
        hair_color TEXT,
        total_xp INTEGER NOT NULL DEFAULT 0 CHECK(total_xp >= 0),
        pr_balance INTEGER NOT NULL DEFAULT 0 CHECK(pr_balance >= 0),
        pr_total_earned INTEGER NOT NULL DEFAULT 0 CHECK(pr_total_earned >= 0),
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
      CREATE TABLE IF NOT EXISTS game_events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        profile_id INTEGER NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
        event_type TEXT NOT NULL,
        event_key TEXT NOT NULL,
        xp_delta INTEGER NOT NULL DEFAULT 0,
        pr_delta INTEGER NOT NULL DEFAULT 0,
        metadata_json TEXT NOT NULL DEFAULT '{}',
        occurred_at TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        UNIQUE(profile_id,event_type,event_key)
      );
      CREATE INDEX IF NOT EXISTS idx_game_events_profile_date ON game_events(profile_id,occurred_at DESC,id DESC);
    `);
    db.prepare('UPDATE schema_meta SET version=?').run(4);
  }
  if (currentVersion < 5) {
    const columns = db.prepare('PRAGMA table_info(game_profiles)').all().map(column=>column.name);
    const additions = [
      ['top_style', "TEXT NOT NULL DEFAULT 'cresci_tank'"],
      ['bottom_style', "TEXT NOT NULL DEFAULT 'training_shorts'"],
      ['shoes_style', "TEXT NOT NULL DEFAULT 'trainers'"],
      ['headwear', "TEXT NOT NULL DEFAULT 'none'"],
      ['accessory', "TEXT NOT NULL DEFAULT 'none'"]
    ];
    for (const [name, definition] of additions) if (!columns.includes(name)) db.exec(`ALTER TABLE game_profiles ADD COLUMN ${name} ${definition}`);
    db.prepare('UPDATE schema_meta SET version=?').run(5);
  }
  if (currentVersion < 6) {
    db.exec(`
      CREATE TABLE IF NOT EXISTS game_records (
        profile_id INTEGER NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
        exercise_id INTEGER NOT NULL REFERENCES exercises(id) ON DELETE CASCADE,
        record_weight REAL NOT NULL CHECK(record_weight >= 0),
        last_source_entry_id INTEGER,
        achieved_at TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now')),
        PRIMARY KEY(profile_id,exercise_id)
      );
      CREATE INDEX IF NOT EXISTS idx_game_records_profile ON game_records(profile_id,record_weight DESC);
      INSERT OR IGNORE INTO game_records(profile_id,exercise_id,record_weight,last_source_entry_id,achieved_at)
      SELECT pe.profile_id,pe.exercise_id,MAX(pe.new_weight),
        (SELECT source.id FROM progress_entries source WHERE source.profile_id=pe.profile_id AND source.exercise_id=pe.exercise_id ORDER BY source.new_weight DESC,source.performed_at,source.id LIMIT 1),
        (SELECT source.performed_at FROM progress_entries source WHERE source.profile_id=pe.profile_id AND source.exercise_id=pe.exercise_id ORDER BY source.new_weight DESC,source.performed_at,source.id LIMIT 1)
      FROM progress_entries pe GROUP BY pe.profile_id,pe.exercise_id;
    `);
    db.prepare('UPDATE schema_meta SET version=?').run(6);
  }
  if (currentVersion < 7) {
    db.exec(`
      CREATE TABLE IF NOT EXISTS pr_transactions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        profile_id INTEGER NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
        source_type TEXT NOT NULL,
        source_key TEXT NOT NULL,
        amount INTEGER NOT NULL,
        balance_after INTEGER NOT NULL CHECK(balance_after >= 0),
        metadata_json TEXT NOT NULL DEFAULT '{}',
        created_at TEXT NOT NULL,
        UNIQUE(profile_id,source_type,source_key)
      );
      CREATE INDEX IF NOT EXISTS idx_pr_transactions_profile_date ON pr_transactions(profile_id,created_at DESC,id DESC);
      CREATE TABLE IF NOT EXISTS user_achievements (
        profile_id INTEGER NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
        achievement_key TEXT NOT NULL,
        unlocked_at TEXT NOT NULL,
        reward_pr INTEGER NOT NULL DEFAULT 0 CHECK(reward_pr >= 0),
        reward_item_key TEXT,
        reward_item_granted INTEGER NOT NULL DEFAULT 0 CHECK(reward_item_granted IN (0,1)),
        metadata_json TEXT NOT NULL DEFAULT '{}',
        PRIMARY KEY(profile_id,achievement_key)
      );
      CREATE INDEX IF NOT EXISTS idx_user_achievements_profile_date ON user_achievements(profile_id,unlocked_at DESC);
      INSERT OR IGNORE INTO pr_transactions(profile_id,source_type,source_key,amount,balance_after,metadata_json,created_at)
      SELECT event.profile_id,'RECORD',event.event_key,event.pr_delta,
        (SELECT COALESCE(SUM(previous.pr_delta),0) FROM game_events previous
         WHERE previous.profile_id=event.profile_id AND previous.event_type='personal_record' AND previous.pr_delta>0
           AND (previous.occurred_at<event.occurred_at OR (previous.occurred_at=event.occurred_at AND previous.id<=event.id))),
        event.metadata_json,event.occurred_at
      FROM game_events event WHERE event.event_type='personal_record' AND event.pr_delta>0;
    `);
    db.prepare('UPDATE schema_meta SET version=?').run(7);
  }
  if (currentVersion < 8) {
    db.exec(`
      CREATE TABLE IF NOT EXISTS user_items (
        profile_id INTEGER NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
        item_key TEXT NOT NULL,
        acquired_source TEXT NOT NULL,
        acquired_at TEXT NOT NULL,
        purchased_price INTEGER NOT NULL DEFAULT 0 CHECK(purchased_price >= 0),
        metadata_json TEXT NOT NULL DEFAULT '{}',
        PRIMARY KEY(profile_id,item_key)
      );
      CREATE INDEX IF NOT EXISTS idx_user_items_profile_date ON user_items(profile_id,acquired_at DESC,item_key);
      INSERT OR IGNORE INTO user_items(profile_id,item_key,acquired_source,acquired_at,purchased_price)
      SELECT profile_id,top_style,'STARTER',created_at,0 FROM game_profiles WHERE avatar_configured=1 AND top_style<>'none'
      UNION ALL SELECT profile_id,bottom_style,'STARTER',created_at,0 FROM game_profiles WHERE avatar_configured=1 AND bottom_style<>'none'
      UNION ALL SELECT profile_id,shoes_style,'STARTER',created_at,0 FROM game_profiles WHERE avatar_configured=1 AND shoes_style<>'none'
      UNION ALL SELECT profile_id,headwear,'STARTER',created_at,0 FROM game_profiles WHERE avatar_configured=1 AND headwear<>'none'
      UNION ALL SELECT profile_id,accessory,'STARTER',created_at,0 FROM game_profiles WHERE avatar_configured=1 AND accessory<>'none';
    `);
    db.prepare('UPDATE schema_meta SET version=?').run(8);
  }
  if (currentVersion < 9) {
    const columns = db.prepare('PRAGMA table_info(game_profiles)').all().map(column=>column.name);
    if (!columns.includes('back_style')) db.exec("ALTER TABLE game_profiles ADD COLUMN back_style TEXT NOT NULL DEFAULT 'none'");
    db.prepare('UPDATE schema_meta SET version=?').run(9);
  }
}

function seed(db) {
  const count = db.prepare('SELECT COUNT(*) AS count FROM profiles').get().count;
  if (count === 0) {
    db.prepare('INSERT INTO profiles(name, color) VALUES (?, ?)').run('Marek', '#ff5d45');
    db.prepare('INSERT INTO profiles(name, color) VALUES (?, ?)').run('Domii', '#7c6df2');
  }
  const exerciseCount = db.prepare('SELECT COUNT(*) AS count FROM exercises').get().count;
  if (exerciseCount === 0) {
    const insert = db.prepare(`
      INSERT INTO exercises(name, category, load_mode, bar_weight, step_size)
      VALUES (?, ?, ?, ?, ?)
    `);
    for (const row of seedExercises) insert.run(...row);
  }
}

export function openDatabase(databasePath) {
  fs.mkdirSync(path.dirname(databasePath), { recursive: true });
  const db = new DatabaseSync(databasePath);
  runMigrations(db);
  seed(db);
  db.exec('PRAGMA optimize;');
  return db;
}

export function createRepository(db) {
  const latestWeight = db.prepare(`
    SELECT new_weight FROM progress_entries
    WHERE profile_id = ? AND exercise_id = ?
    ORDER BY performed_at DESC, id DESC LIMIT 1
  `);

  function recalculateSeries(profileId, exerciseId, fromDate = '', fromId = 0) {
    const rows = db.prepare(`SELECT id, performed_at, new_weight FROM progress_entries WHERE profile_id=? AND exercise_id=? ORDER BY performed_at, id`).all(profileId, exerciseId);
    const update = db.prepare('UPDATE progress_entries SET old_weight=?, increment=?, change_type=? WHERE id=?');
    const start = rows.findIndex(row => row.performed_at > fromDate || (row.performed_at === fromDate && row.id >= fromId));
    if (start < 0) return;
    let previous = start > 0 ? rows[start - 1].new_weight : null;
    for (const row of rows.slice(start)) {
      const increment = previous === null ? 0 : row.new_weight - previous;
      const changeType = previous === null ? 'start' : increment > 0 ? 'increase' : increment < 0 ? 'decrease' : 'repeat';
      update.run(previous, increment, changeType, row.id);
      previous = row.new_weight;
    }
  }

  function postPrTransaction(profileId, sourceType, sourceKey, amount, metadata = {}, createdAt = new Date().toISOString()) {
    const profile=db.prepare('SELECT pr_balance FROM game_profiles WHERE profile_id=?').get(profileId);
    if(!profile)return false;
    const delta=Number(amount)||0,balanceAfter=Number(profile.pr_balance)+delta;
    if(balanceAfter<0)throw new Error('Za mało PR.');
    const result=db.prepare(`INSERT OR IGNORE INTO pr_transactions(profile_id,source_type,source_key,amount,balance_after,metadata_json,created_at)
      VALUES(?,?,?,?,?,?,?)`).run(profileId,sourceType,sourceKey,delta,balanceAfter,JSON.stringify(metadata||{}),createdAt);
    if(!Number(result.changes))return false;
    db.prepare(`UPDATE game_profiles SET pr_balance=?,pr_total_earned=pr_total_earned+?,updated_at=datetime('now') WHERE profile_id=?`)
      .run(balanceAfter,Math.max(0,delta),profileId);
    return true;
  }

  function safeMetadata(value){try{return JSON.parse(value||'{}')}catch{return{}}}

  function grantAvatarOwnership(profileId, avatar, source='STARTER') {
    const insert=db.prepare(`INSERT OR IGNORE INTO user_items(profile_id,item_key,acquired_source,acquired_at,purchased_price,metadata_json) VALUES(?,?,?,?,0,'{}')`);
    const acquiredAt=new Date().toISOString();
    for(const item of avatarItems(avatar))insert.run(profileId,item.key,source,acquiredAt);
  }

  function decoratedItem(definition, ownedRow, profile) {
    const field=avatarFieldForSlot(definition.slot);
    return{
      ...definition,price_pr:definition.pricePr,slot_label:SLOT_LABELS[definition.slot],rarity_label:RARITY_LABELS[definition.rarity],
      owned:Boolean(ownedRow),equipped:profile?.[field]===definition.key,
      acquired_source:ownedRow?.acquired_source||null,acquired_at:ownedRow?.acquired_at||null
    };
  }

  function hasFullEquipment(profileId) {
    const profile=db.prepare('SELECT * FROM game_profiles WHERE profile_id=?').get(profileId);if(!profile)return false;
    const keys=ITEM_SLOTS.filter(slot=>slot!=='back').map(slot=>profile[avatarFieldForSlot(slot)]);
    if(keys.some(key=>!key||key==='none'))return false;
    const owned=new Set(db.prepare('SELECT item_key FROM user_items WHERE profile_id=?').all(profileId).map(row=>row.item_key));
    return keys.every(key=>owned.has(key));
  }

  function achievementMetrics(profileId) {
    const events=db.prepare('SELECT event_type,event_key,metadata_json FROM game_events WHERE profile_id=? ORDER BY occurred_at,id').all(profileId);
    const checkIns=events.filter(event=>event.event_type==='check_in');
    const records=events.filter(event=>event.event_type==='personal_record'&&Number(safeMetadata(event.metadata_json).new_record)>=0);
    const savedResults=events.filter(event=>event.event_type==='saved_result');
    const recordsByExercise=new Map();
    for(const event of records){const exerciseId=safeMetadata(event.metadata_json).exercise_id;recordsByExercise.set(exerciseId,(recordsByExercise.get(exerciseId)||0)+1);}
    const eventCount=type=>events.filter(event=>event.event_type===type).length;
    const weeklyGoal=Number(db.prepare('SELECT weekly_goal FROM score_settings WHERE profile_id=?').get(profileId)?.weekly_goal)||3;
    return {
      check_ins:checkIns.length,
      records:records.length,
      records_single_exercise:Math.max(0,...recordsByExercise.values()),
      weekly_streak:longestCompletedWeeklyStreak(checkIns.map(event=>event.event_key),weeklyGoal),
      custom_exercises:eventCount('custom_exercise'),
      distinct_exercises:new Set(savedResults.map(event=>safeMetadata(event.metadata_json).exercise_id).filter(Boolean)).size,
      chart_views:eventCount('view_progress_chart'),
      saved_results:savedResults.length,
      items_acquired:eventCount('item_acquired'),
      purchases:eventCount('purchase'),
      full_equipment:eventCount('equipment_full'),
      night_check_ins:checkIns.filter(event=>Number(safeMetadata(event.metadata_json).local_hour)>=22).length,
      early_check_ins:checkIns.filter(event=>Number(safeMetadata(event.metadata_json).local_hour)<6).length,
      comeback_check_ins:checkIns.filter(event=>Number(safeMetadata(event.metadata_json).gap_days)>=30).length,
      pr_balance:Number(db.prepare('SELECT pr_balance FROM game_profiles WHERE profile_id=?').get(profileId)?.pr_balance)||0
    };
  }

  function evaluateAchievements(profileId, unlockedAt = new Date().toISOString()) {
    if(!db.prepare('SELECT enabled FROM game_profiles WHERE profile_id=?').get(profileId)?.enabled)return[];
    const metrics=achievementMetrics(profileId),existing=new Set(db.prepare('SELECT achievement_key FROM user_achievements WHERE profile_id=?').all(profileId).map(row=>row.achievement_key));
    const candidates=ACHIEVEMENTS.filter(definition=>!existing.has(definition.key)&&achievementProgress(definition,metrics).complete);
    const unlocked=[];
    for(const definition of candidates){
      const inserted=db.prepare(`INSERT OR IGNORE INTO user_achievements(profile_id,achievement_key,unlocked_at,reward_pr,reward_item_key,reward_item_granted,metadata_json)
        VALUES(?,?,?,?,?,0,?)`).run(profileId,definition.key,unlockedAt,definition.rewardPr,definition.rewardItemKey||null,JSON.stringify({metric:definition.metric,value:metrics[definition.metric],target:definition.target}));
      if(!Number(inserted.changes))continue;
      postPrTransaction(profileId,'ACHIEVEMENT',definition.key,definition.rewardPr,{achievement_key:definition.key},unlockedAt);
      unlocked.push({...definition,unlocked_at:unlockedAt});
    }
    return unlocked;
  }

  function registerPersonalRecord({profileId,exerciseId,weight,entryId,occurredAt,allowAward}) {
    const current=db.prepare('SELECT record_weight FROM game_records WHERE profile_id=? AND exercise_id=?').get(profileId,exerciseId);
    if(!current){
      db.prepare(`INSERT INTO game_records(profile_id,exercise_id,record_weight,last_source_entry_id,achieved_at) VALUES(?,?,?,?,?)`).run(profileId,exerciseId,weight,entryId,occurredAt);
      return{is_personal_record:false,pr_awarded:0,previous_record:null,personal_record:weight};
    }
    if(weight<=current.record_weight)return{is_personal_record:false,pr_awarded:0,previous_record:current.record_weight,personal_record:current.record_weight};
    db.prepare(`UPDATE game_records SET record_weight=?,last_source_entry_id=?,achieved_at=?,updated_at=datetime('now') WHERE profile_id=? AND exercise_id=?`).run(weight,entryId,occurredAt,profileId,exerciseId);
    let prAwarded=0;
    const gameEnabled=Boolean(db.prepare('SELECT enabled FROM game_profiles WHERE profile_id=?').get(profileId)?.enabled);
    if(allowAward&&gameEnabled){
      const eventKey=`exercise:${exerciseId}:entry:${entryId}`;
      const event=db.prepare(`INSERT OR IGNORE INTO game_events(profile_id,event_type,event_key,xp_delta,pr_delta,metadata_json,occurred_at)
        VALUES(?,'personal_record',?,0,1,?,?)`).run(profileId,eventKey,JSON.stringify({exercise_id:exerciseId,entry_id:entryId,previous_record:current.record_weight,new_record:weight}),occurredAt);
      if(Number(event.changes)>0&&postPrTransaction(profileId,'RECORD',eventKey,1,{exercise_id:exerciseId,entry_id:entryId,previous_record:current.record_weight,new_record:weight},occurredAt))prAwarded=1;
    }
    return{is_personal_record:true,pr_awarded:prAwarded,previous_record:current.record_weight,personal_record:weight};
  }

  return {
    bootstrap() {
      const profiles = db.prepare('SELECT id, name, color FROM profiles ORDER BY id').all();
      const scoreSettings = db.prepare(`SELECT p.id AS user_id, p.name AS user_name, p.color,
        COALESCE(s.enabled,0) AS enabled, COALESCE(s.weekly_goal,3) AS weekly_goal
        FROM profiles p LEFT JOIN score_settings s ON s.profile_id=p.id ORDER BY p.id`).all();
      const gameSettings = this.gameSettings();
      const exercises = db.prepare(`
        SELECT e.*,
          (SELECT COUNT(*) FROM progress_entries count_entries WHERE count_entries.exercise_id=e.id) AS entry_count,
          (SELECT pe.new_weight FROM progress_entries pe WHERE pe.exercise_id=e.id AND pe.profile_id=1 ORDER BY pe.performed_at DESC, pe.id DESC LIMIT 1) AS marek_weight,
          (SELECT pe.performed_at FROM progress_entries pe WHERE pe.exercise_id=e.id AND pe.profile_id=1 ORDER BY pe.performed_at DESC, pe.id DESC LIMIT 1) AS marek_date,
          (SELECT pe.plates_or_steps FROM progress_entries pe WHERE pe.exercise_id=e.id AND pe.profile_id=1 ORDER BY pe.performed_at DESC, pe.id DESC LIMIT 1) AS marek_plates,
          (SELECT pe.new_weight FROM progress_entries pe WHERE pe.exercise_id=e.id AND pe.profile_id=2 ORDER BY pe.performed_at DESC, pe.id DESC LIMIT 1) AS domii_weight,
          (SELECT pe.performed_at FROM progress_entries pe WHERE pe.exercise_id=e.id AND pe.profile_id=2 ORDER BY pe.performed_at DESC, pe.id DESC LIMIT 1) AS domii_date,
          (SELECT pe.plates_or_steps FROM progress_entries pe WHERE pe.exercise_id=e.id AND pe.profile_id=2 ORDER BY pe.performed_at DESC, pe.id DESC LIMIT 1) AS domii_plates
        FROM exercises e WHERE active=1 ORDER BY category, name
      `).all();
      const archivedExercises = db.prepare(`
        SELECT e.id, e.name, e.category, e.active,
          (SELECT COUNT(*) FROM progress_entries pe WHERE pe.exercise_id=e.id) AS entry_count
        FROM exercises e WHERE active=0 ORDER BY category, name
      `).all();
      const stats = db.prepare(`
        SELECT
          (SELECT COUNT(*) FROM progress_entries) AS entries,
          (SELECT COUNT(*) FROM exercises WHERE active=1) AS exercises,
          (SELECT COUNT(DISTINCT performed_at) FROM progress_entries) AS training_days
      `).get();
      return { profiles, exercises, archived_exercises:archivedExercises, score_settings:scoreSettings, game_settings:gameSettings, stats };
    },

    gameSettings() {
      return db.prepare(`SELECT p.id AS user_id,p.name AS user_name,p.color,
        COALESCE(g.enabled,0) AS enabled,COALESCE(g.avatar_configured,0) AS avatar_configured,
        g.avatar_gender AS gender,g.skin_tone,g.eye_color,g.hairstyle,g.hair_color,COALESCE(g.back_style,'none') AS back_style,
        COALESCE(g.top_style,'cresci_tank') AS top_style,COALESCE(g.bottom_style,'training_shorts') AS bottom_style,
        COALESCE(g.shoes_style,'trainers') AS shoes_style,COALESCE(g.headwear,'none') AS headwear,COALESCE(g.accessory,'none') AS accessory,
        COALESCE(g.total_xp,0) AS total_xp,COALESCE(g.pr_balance,0) AS pr_balance,
        COALESCE(g.pr_total_earned,0) AS pr_total_earned
        FROM profiles p LEFT JOIN game_profiles g ON g.profile_id=p.id ORDER BY p.id`).all();
    },

    updateGameSettings(userId, input) {
      const profile = db.prepare('SELECT id FROM profiles WHERE id=?').get(userId);
      if (!profile) return null;
      const current = db.prepare('SELECT * FROM game_profiles WHERE profile_id=?').get(userId);
      const enabled = Number(Boolean(input.enabled));
      let avatar = null;
      if (input.avatar) avatar = validateAvatar(input.avatar);
      if (enabled && !avatar && !current?.avatar_configured) throw new Error('Najpierw utwórz avatar postaci.');
      if(current?.avatar_configured&&avatar){
        for(const item of avatarItems(avatar)){
          const field=avatarFieldForSlot(item.slot);
          if(current[field]!==item.key&&!db.prepare('SELECT 1 FROM user_items WHERE profile_id=? AND item_key=?').get(userId,item.key))throw new Error('Ten element stroju nie znajduje się w ekwipunku. Użyj sklepu CRESCI GAME.');
        }
      }
      if (!current) {
        db.prepare(`INSERT INTO game_profiles(profile_id,enabled,avatar_configured,avatar_gender,skin_tone,eye_color,hairstyle,hair_color,back_style,top_style,bottom_style,shoes_style,headwear,accessory)
          VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(userId,enabled,avatar?1:0,avatar?.gender||null,avatar?.skin_tone||null,avatar?.eye_color||null,avatar?.hairstyle||null,avatar?.hair_color||null,avatar?.back_style||'none',avatar?.top_style||'cresci_tank',avatar?.bottom_style||'training_shorts',avatar?.shoes_style||'trainers',avatar?.headwear||'none',avatar?.accessory||'none');
      } else if (avatar) {
        db.prepare(`UPDATE game_profiles SET enabled=?,avatar_configured=1,avatar_gender=?,skin_tone=?,eye_color=?,hairstyle=?,hair_color=?,back_style=?,top_style=?,bottom_style=?,shoes_style=?,headwear=?,accessory=?,updated_at=datetime('now') WHERE profile_id=?`)
          .run(enabled,avatar.gender,avatar.skin_tone,avatar.eye_color,avatar.hairstyle,avatar.hair_color,avatar.back_style,avatar.top_style,avatar.bottom_style,avatar.shoes_style,avatar.headwear,avatar.accessory,userId);
      } else {
        db.prepare(`UPDATE game_profiles SET enabled=?,updated_at=datetime('now') WHERE profile_id=?`).run(enabled,userId);
      }
      if(avatar)grantAvatarOwnership(userId,avatar);
      return this.gameSettings().find(item=>item.user_id===Number(userId));
    },

    gameStates(asOf = new Date().toISOString().slice(0,10)) {
      return this.gameSettings().filter(item=>item.enabled).map(item=>({
        ...item,
        ...levelFromXp(item.total_xp),
        checked_in_today: Boolean(db.prepare(`SELECT 1 FROM game_events WHERE profile_id=? AND event_type='check_in' AND event_key=?`).get(item.user_id,asOf)),
        check_in_xp: CHECK_IN_XP
      }));
    },

    gameCheckIn(userId, date = null, context = {}) {
      const now=context.now instanceof Date?context.now:new Date();
      const localDate=`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;
      const checkInDate=date||localDate;
      const localHour=Number.isInteger(context.local_hour)?context.local_hour:(date?12:now.getHours());
      const occurredAt=context.occurred_at||now.toISOString();
      if (!/^\d{4}-\d{2}-\d{2}$/.test(checkInDate)) throw new Error('Nieprawidłowa data meldunku.');
      if(localHour<0||localHour>23)throw new Error('Nieprawidłowa godzina meldunku.');
      const game = db.prepare('SELECT * FROM game_profiles WHERE profile_id=?').get(userId);
      if (!game?.enabled || !game.avatar_configured) throw new Error('CRESCI GAME nie jest włączony dla tego użytkownika.');
      db.exec('BEGIN IMMEDIATE');
      let unlockedAchievements=[];
      try {
        const previous=db.prepare(`SELECT event_key FROM game_events WHERE profile_id=? AND event_type='check_in' ORDER BY event_key DESC LIMIT 1`).get(userId);
        const gapDays=previous?Math.floor((Date.parse(`${checkInDate}T00:00:00Z`)-Date.parse(`${previous.event_key}T00:00:00Z`))/86400000):null;
        db.prepare(`INSERT INTO game_events(profile_id,event_type,event_key,xp_delta,pr_delta,metadata_json,occurred_at)
          VALUES(?,'check_in',?,?,0,?,?)`).run(userId,checkInDate,CHECK_IN_XP,JSON.stringify({local_hour:localHour,gap_days:gapDays}),occurredAt);
        db.prepare(`UPDATE game_profiles SET total_xp=total_xp+?,updated_at=datetime('now') WHERE profile_id=?`).run(CHECK_IN_XP,userId);
        unlockedAchievements=evaluateAchievements(Number(userId),occurredAt);
        db.exec('COMMIT');
      } catch (error) {
        db.exec('ROLLBACK');
        if (/UNIQUE constraint/.test(error.message)) throw new Error('Dzisiejszy meldunek został już zapisany.');
        throw error;
      }
      return {...this.gameStates(checkInDate).find(item=>item.user_id===Number(userId)),unlocked_achievements:unlockedAchievements};
    },

    achievements(userId) {
      const profile=this.gameSettings().find(item=>item.user_id===Number(userId));
      if(!profile||!Number(profile.enabled))return null;
      const metrics=achievementMetrics(Number(userId));
      const unlocked=new Map(db.prepare('SELECT * FROM user_achievements WHERE profile_id=?').all(userId).map(row=>[row.achievement_key,row]));
      const items=ACHIEVEMENTS.map(definition=>{
        const saved=unlocked.get(definition.key),progress=achievementProgress(definition,metrics),masked=definition.hidden&&!saved;
        return{
          key:definition.key,category:definition.category,category_label:ACHIEVEMENT_CATEGORIES[definition.category],
          name:masked?'???':definition.name,description:masked?'Ukryte osiągnięcie':definition.description,
          icon:masked?'?':definition.category.slice(0,2).toUpperCase(),reward_pr:definition.rewardPr,reward_item_key:definition.rewardItemKey||null,
          progress:masked?null:progress,unlocked:Boolean(saved),unlocked_at:saved?.unlocked_at||null
        };
      });
      return{user_id:profile.user_id,user_name:profile.user_name,color:profile.color,unlocked_count:unlocked.size,total_count:ACHIEVEMENTS.length,items};
    },

    inventory(userId) {
      const profile=this.gameSettings().find(item=>item.user_id===Number(userId));
      if(!profile||!Number(profile.enabled))return null;
      const ownedRows=db.prepare('SELECT * FROM user_items WHERE profile_id=? ORDER BY acquired_at,item_key').all(userId);
      const owned=new Map(ownedRows.map(row=>[row.item_key,row]));
      return{
        user_id:profile.user_id,user_name:profile.user_name,color:profile.color,pr_balance:profile.pr_balance,
        slots:ITEM_SLOTS.map(slot=>({key:slot,label:SLOT_LABELS[slot],equipped_key:profile[avatarFieldForSlot(slot)]||'none'})),
        items:GAME_ITEMS.filter(item=>owned.has(item.key)).map(item=>decoratedItem(item,owned.get(item.key),profile))
      };
    },

    shop(userId) {
      const profile=this.gameSettings().find(item=>item.user_id===Number(userId));
      if(!profile||!Number(profile.enabled))return null;
      const owned=new Map(db.prepare('SELECT * FROM user_items WHERE profile_id=?').all(userId).map(row=>[row.item_key,row]));
      return{user_id:profile.user_id,user_name:profile.user_name,color:profile.color,pr_balance:profile.pr_balance,items:GAME_ITEMS.map(item=>decoratedItem(item,owned.get(item.key),profile))};
    },

    purchaseItem(userId, itemKey) {
      const definition=gameItem(itemKey);if(!definition)throw new Error('Nie znaleziono itemu.');
      const game=db.prepare('SELECT * FROM game_profiles WHERE profile_id=?').get(userId);
      if(!game?.enabled)throw new Error('CRESCI GAME nie jest włączony dla tego użytkownika.');
      if(db.prepare('SELECT 1 FROM user_items WHERE profile_id=? AND item_key=?').get(userId,itemKey))throw new Error('Ten item jest już w ekwipunku.');
      if(Number(game.pr_balance)<definition.pricePr)throw new Error(`Brakuje ${definition.pricePr-Number(game.pr_balance)} PR do zakupu.`);
      const occurredAt=new Date().toISOString();let unlockedAchievements=[];
      db.exec('BEGIN IMMEDIATE');
      try{
        const paid=postPrTransaction(userId,'SHOP_PURCHASE',definition.key,-definition.pricePr,{item_key:definition.key,slot:definition.slot,price_pr:definition.pricePr},occurredAt);
        if(!paid)throw new Error('Ten zakup został już rozliczony.');
        db.prepare(`INSERT INTO user_items(profile_id,item_key,acquired_source,acquired_at,purchased_price,metadata_json) VALUES(?,?,'PURCHASE',?,?,?)`)
          .run(userId,definition.key,occurredAt,definition.pricePr,JSON.stringify({slot:definition.slot,rarity:definition.rarity}));
        db.prepare(`INSERT OR IGNORE INTO game_events(profile_id,event_type,event_key,xp_delta,pr_delta,metadata_json,occurred_at) VALUES(?,'item_acquired',?,0,0,?,?)`)
          .run(userId,definition.key,JSON.stringify({item_key:definition.key,source:'PURCHASE'}),occurredAt);
        db.prepare(`INSERT OR IGNORE INTO game_events(profile_id,event_type,event_key,xp_delta,pr_delta,metadata_json,occurred_at) VALUES(?,'purchase',?,0,0,?,?)`)
          .run(userId,definition.key,JSON.stringify({item_key:definition.key,price_pr:definition.pricePr}),occurredAt);
        unlockedAchievements=evaluateAchievements(Number(userId),occurredAt);
        db.exec('COMMIT');
      }catch(error){db.exec('ROLLBACK');throw error;}
      return{ok:true,item:decoratedItem(definition,db.prepare('SELECT * FROM user_items WHERE profile_id=? AND item_key=?').get(userId,itemKey),this.gameSettings().find(item=>item.user_id===Number(userId))),inventory:this.inventory(userId),unlocked_achievements:unlockedAchievements};
    },

    equipItem(userId, slot, itemKey=null) {
      if(!ITEM_SLOTS.includes(slot))throw new Error('Nieprawidłowy slot ekwipunku.');
      const game=db.prepare('SELECT * FROM game_profiles WHERE profile_id=?').get(userId);
      if(!game?.enabled)throw new Error('CRESCI GAME nie jest włączony dla tego użytkownika.');
      const field=avatarFieldForSlot(slot),key=itemKey&&itemKey!=='none'?String(itemKey):'none';
      if(key!=='none'){
        const definition=gameItem(key);if(!definition||definition.slot!==slot)throw new Error('Ten item nie pasuje do wybranego slotu.');
        if(!db.prepare('SELECT 1 FROM user_items WHERE profile_id=? AND item_key=?').get(userId,key))throw new Error('Najpierw zdobądź ten item.');
      }
      const occurredAt=new Date().toISOString();let unlockedAchievements=[];
      db.exec('BEGIN IMMEDIATE');
      try{
        db.prepare(`UPDATE game_profiles SET ${field}=?,updated_at=datetime('now') WHERE profile_id=?`).run(key,userId);
        if(hasFullEquipment(userId))db.prepare(`INSERT OR IGNORE INTO game_events(profile_id,event_type,event_key,xp_delta,pr_delta,metadata_json,occurred_at) VALUES(?,'equipment_full','all-slots',0,0,'{}',?)`).run(userId,occurredAt);
        unlockedAchievements=evaluateAchievements(Number(userId),occurredAt);
        db.exec('COMMIT');
      }catch(error){db.exec('ROLLBACK');throw error;}
      return{ok:true,inventory:this.inventory(userId),game:this.gameStates().find(item=>item.user_id===Number(userId)),unlocked_achievements:unlockedAchievements};
    },

    recordGameAction(userId, action, details = {}) {
      const allowed={view_progress_chart:'first'};
      if(!(action in allowed))throw new Error('Nieobsługiwana akcja CRESCI GAME.');
      const game=db.prepare('SELECT enabled FROM game_profiles WHERE profile_id=?').get(userId);
      if(!game?.enabled)return{recorded:false,unlocked_achievements:[]};
      const key=allowed[action];if(!key)throw new Error('Brakuje identyfikatora akcji.');
      db.exec('BEGIN IMMEDIATE');
      try{
        const result=db.prepare(`INSERT OR IGNORE INTO game_events(profile_id,event_type,event_key,xp_delta,pr_delta,metadata_json,occurred_at) VALUES(?,?,?,0,0,?,?)`)
          .run(userId,action,key,JSON.stringify(details||{}),new Date().toISOString());
        const unlockedAchievements=Number(result.changes)?evaluateAchievements(Number(userId)):[];
        db.exec('COMMIT');return{recorded:Boolean(result.changes),unlocked_achievements:unlockedAchievements};
      }catch(error){db.exec('ROLLBACK');throw error;}
    },

    scoreSettings() {
      return db.prepare(`SELECT p.id AS user_id, p.name AS user_name, p.color,
        COALESCE(s.enabled,0) AS enabled, COALESCE(s.weekly_goal,3) AS weekly_goal
        FROM profiles p LEFT JOIN score_settings s ON s.profile_id=p.id ORDER BY p.id`).all();
    },

    updateScoreSettings(userId,input) {
      const profile=db.prepare('SELECT id FROM profiles WHERE id=?').get(userId);
      if(!profile)return null;
      const weeklyGoal=Number(input.weekly_goal),enabled=Number(Boolean(input.enabled));
      if(!Number.isInteger(weeklyGoal)||weeklyGoal<1||weeklyGoal>7)throw new Error('Cel treningów musi wynosić od 1 do 7 tygodniowo.');
      db.prepare(`INSERT INTO score_settings(profile_id,enabled,weekly_goal,updated_at) VALUES(?,?,?,datetime('now'))
        ON CONFLICT(profile_id) DO UPDATE SET enabled=excluded.enabled,weekly_goal=excluded.weekly_goal,updated_at=datetime('now')`).run(userId,enabled,weeklyGoal);
      return this.scoreSettings().find(item=>item.user_id===Number(userId));
    },

    cresciScores(asOf=new Date().toISOString().slice(0,10)) {
      return this.scoreSettings().filter(setting=>setting.enabled).map(setting=>{
        const entries=db.prepare('SELECT id,profile_id,exercise_id,performed_at,new_weight FROM progress_entries WHERE profile_id=? AND performed_at<=? ORDER BY performed_at,id').all(setting.user_id,asOf);
        const activeExerciseIds=db.prepare(`SELECT DISTINCT e.id FROM exercises e JOIN progress_entries pe ON pe.exercise_id=e.id
          WHERE e.active=1 AND pe.profile_id=? ORDER BY e.id`).all(setting.user_id).map(row=>row.id);
        return calculateCresciScore({userId:setting.user_id,userName:setting.user_name,weeklyGoal:setting.weekly_goal,entries,activeExerciseIds,asOf});
      });
    },

    addExercise(input) {
      db.exec('BEGIN IMMEDIATE');
      try{
        const result = db.prepare(`INSERT INTO exercises(name, category, load_mode, bar_weight, step_size) VALUES (?, ?, ?, ?, ?)`)
          .run(input.name.trim(), input.category?.trim() || 'Inne', input.load_mode || 'direct', Number(input.bar_weight || 0), Number(input.step_size || 1));
        let unlockedAchievements=[];
        const creatorId=Number(input.creator_user_id);
        if(input.origin==='custom'&&Number.isInteger(creatorId)&&db.prepare('SELECT enabled FROM game_profiles WHERE profile_id=?').get(creatorId)?.enabled){
          db.prepare(`INSERT OR IGNORE INTO game_events(profile_id,event_type,event_key,xp_delta,pr_delta,metadata_json,occurred_at) VALUES(?,'custom_exercise',?,0,0,?,?)`)
            .run(creatorId,`exercise:${result.lastInsertRowid}`,JSON.stringify({exercise_id:Number(result.lastInsertRowid)}),new Date().toISOString());
          unlockedAchievements=evaluateAchievements(creatorId);
        }
        db.exec('COMMIT');
        return{...db.prepare('SELECT * FROM exercises WHERE id=?').get(result.lastInsertRowid),unlocked_achievements:unlockedAchievements};
      }catch(error){db.exec('ROLLBACK');throw error;}
    },

    updateExercise(id, input) {
      const current = db.prepare('SELECT * FROM exercises WHERE id=?').get(id);
      if (!current) return null;
      db.prepare(`
        UPDATE exercises SET name=?, category=?, load_mode=?, bar_weight=?, step_size=?, active=?, updated_at=datetime('now')
        WHERE id=?
      `).run(
        input.name?.trim() || current.name,
        input.category?.trim() || current.category,
        input.load_mode || current.load_mode,
        Number(input.bar_weight ?? current.bar_weight),
        Number(input.step_size ?? current.step_size),
        input.active === undefined ? current.active : Number(Boolean(input.active)),
        id
      );
      return db.prepare('SELECT * FROM exercises WHERE id=?').get(id);
    },

    deleteExercise(id) {
      const current = db.prepare('SELECT * FROM exercises WHERE id=?').get(id);
      if (!current) return null;
      const historyEntries = Number(db.prepare('SELECT COUNT(*) AS count FROM progress_entries WHERE exercise_id=?').get(id).count);
      if (historyEntries > 0) {
        db.prepare("UPDATE exercises SET active=0, updated_at=datetime('now') WHERE id=?").run(id);
        return { id, name:current.name, archived:true, history_entries:historyEntries };
      }
      db.prepare('DELETE FROM exercises WHERE id=?').run(id);
      return { id, name:current.name, archived:false, history_entries:0 };
    },

    addEntry(input) {
      const old = latestWeight.get(input.profile_id, input.exercise_id)?.new_weight ?? null;
      const hasWeight = input.new_weight !== undefined && input.new_weight !== null && String(input.new_weight).trim() !== '';
      if (!hasWeight && old === null) throw new Error('Przy pierwszym wpisie podaj ciężar w kg.');
      const weight = hasWeight ? Number(input.new_weight) : old;
      const increment = old === null ? 0 : weight - old;
      const changeType = old === null ? 'start' : increment > 0 ? 'increase' : increment < 0 ? 'decrease' : 'repeat';
      const changeLabel = input.change_label?.trim() || (input.plates_or_steps?.trim() && !hasWeight ? 'Dołożenie krążka' : 'Zmiana ciężaru');
      const date = input.performed_at || new Date().toISOString().slice(0, 10);
      db.exec('BEGIN IMMEDIATE');
      try {
        const result = db.prepare(`
          INSERT INTO progress_entries(profile_id, exercise_id, performed_at, old_weight, new_weight, increment, plates_or_steps, change_type, change_label, note)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(input.profile_id, input.exercise_id, date, old, weight, increment, input.plates_or_steps?.trim() || '', changeType, changeLabel, input.note?.trim() || '');
        const profileId=Number(input.profile_id);
        if(db.prepare('SELECT enabled FROM game_profiles WHERE profile_id=?').get(profileId)?.enabled){
          db.prepare(`INSERT OR IGNORE INTO game_events(profile_id,event_type,event_key,xp_delta,pr_delta,metadata_json,occurred_at) VALUES(?,'saved_result',?,0,0,?,?)`)
            .run(profileId,`entry:${result.lastInsertRowid}`,JSON.stringify({entry_id:Number(result.lastInsertRowid),exercise_id:Number(input.exercise_id)}),date);
        }
        const record=registerPersonalRecord({profileId,exerciseId:Number(input.exercise_id),weight,entryId:Number(result.lastInsertRowid),occurredAt:date,allowAward:true});
        const unlockedAchievements=evaluateAchievements(profileId,date);
        db.exec('COMMIT');
        const entry=db.prepare(`
        SELECT pe.*, p.name AS profile_name, p.color AS profile_color, e.name AS exercise_name
        FROM progress_entries pe JOIN profiles p ON p.id=pe.profile_id JOIN exercises e ON e.id=pe.exercise_id
        WHERE pe.id=?
        `).get(result.lastInsertRowid);
        return{...entry,...record,unlocked_achievements:unlockedAchievements};
      } catch(error){db.exec('ROLLBACK');throw error;}
    },

    updateEntry(id, input) {
      const current = db.prepare('SELECT * FROM progress_entries WHERE id=?').get(id);
      if (!current) return null;
      const weight = Number(input.new_weight);
      if (!Number.isFinite(weight) || weight < 0) throw new Error('Podaj poprawny ciężar.');
      const date = input.performed_at?.trim() || current.performed_at;
      db.exec('BEGIN IMMEDIATE');
      try {
        db.prepare(`UPDATE progress_entries SET performed_at=?, new_weight=?, plates_or_steps=?, change_label=?, note=? WHERE id=?`).run(
          date, weight, input.plates_or_steps?.trim() || '', input.change_label?.trim() || current.change_label, input.note?.trim() || '', id
        );
        const fromDate = date < current.performed_at ? date : current.performed_at;
        const fromId = date < current.performed_at ? id : current.id;
        recalculateSeries(current.profile_id, current.exercise_id, fromDate, fromId);
        registerPersonalRecord({profileId:current.profile_id,exerciseId:current.exercise_id,weight,entryId:id,occurredAt:date,allowAward:false});
        db.exec('COMMIT');
      } catch (error) { db.exec('ROLLBACK'); throw error; }
      return this.history().find(entry => entry.id === id) || null;
    },

    deleteEntry(id) {
      const current = db.prepare('SELECT * FROM progress_entries WHERE id=?').get(id);
      if (!current) return false;
      db.exec('BEGIN IMMEDIATE');
      try {
        db.prepare('DELETE FROM progress_entries WHERE id=?').run(id);
        recalculateSeries(current.profile_id, current.exercise_id, current.performed_at, current.id);
        db.exec('COMMIT');
      } catch (error) { db.exec('ROLLBACK'); throw error; }
      return true;
    },

    history(filters = {}) {
      const where = [];
      const params = [];
      if (filters.profile_id) { where.push('pe.profile_id=?'); params.push(filters.profile_id); }
      if (filters.exercise_id) { where.push('pe.exercise_id=?'); params.push(filters.exercise_id); }
      const clause = where.length ? `WHERE ${where.join(' AND ')}` : '';
      return db.prepare(`
        SELECT pe.*, p.name AS profile_name, p.color AS profile_color, e.name AS exercise_name, e.active AS exercise_active,
          (SELECT previous.plates_or_steps FROM progress_entries previous
           WHERE previous.profile_id=pe.profile_id AND previous.exercise_id=pe.exercise_id
             AND (previous.performed_at < pe.performed_at OR (previous.performed_at=pe.performed_at AND previous.id < pe.id))
           ORDER BY previous.performed_at DESC, previous.id DESC LIMIT 1) AS old_plates_or_steps
        FROM progress_entries pe JOIN profiles p ON p.id=pe.profile_id JOIN exercises e ON e.id=pe.exercise_id
        ${clause} ORDER BY pe.performed_at DESC, pe.id DESC LIMIT 500
      `).all(...params);
    },

    progress(profileId, exerciseId) {
      return db.prepare(`
        SELECT performed_at, new_weight, increment, plates_or_steps
        FROM progress_entries WHERE profile_id=? AND exercise_id=?
        ORDER BY performed_at, id
      `).all(profileId, exerciseId);
    },

    overallProgress(profileId = null) {
      const rows = profileId
        ? db.prepare(`SELECT profile_id, exercise_id, performed_at, new_weight FROM progress_entries WHERE profile_id=? AND new_weight>0 ORDER BY performed_at, id`).all(profileId)
        : db.prepare(`SELECT profile_id, exercise_id, performed_at, new_weight FROM progress_entries WHERE new_weight>0 ORDER BY profile_id, performed_at, id`).all();
      const byProfile = new Map();
      for (const row of rows) {
        if (!byProfile.has(row.profile_id)) byProfile.set(row.profile_id, []);
        byProfile.get(row.profile_id).push(row);
      }
      const result = [];
      for (const [currentProfileId, entries] of byProfile) {
        const baseline = new Map();
        const latest = new Map();
        const days = new Map();
        for (const entry of entries) {
          if (!days.has(entry.performed_at)) days.set(entry.performed_at, []);
          days.get(entry.performed_at).push(entry);
        }
        for (const [date, dayEntries] of days) {
          for (const entry of dayEntries) {
            if (!baseline.has(entry.exercise_id)) baseline.set(entry.exercise_id, entry.new_weight);
            latest.set(entry.exercise_id, entry.new_weight);
          }
          const indexes = [...latest].map(([exerciseId, weight]) => weight / baseline.get(exerciseId) * 100);
          result.push({ profile_id: currentProfileId, performed_at: date, index_value: indexes.reduce((a,b)=>a+b,0)/indexes.length, exercise_count:indexes.length });
        }
      }
      return result;
    },

    gameRecords(userId=null) {
      return userId
        ? db.prepare('SELECT * FROM game_records WHERE profile_id=? ORDER BY exercise_id').all(userId)
        : db.prepare('SELECT * FROM game_records ORDER BY profile_id,exercise_id').all();
    },

    exportData() {
      return {
        format: 'gym-progress-backup', version: SCHEMA_VERSION, exported_at: new Date().toISOString(),
        profiles: db.prepare('SELECT id, name, color, created_at FROM profiles ORDER BY id').all(),
        score_settings: db.prepare('SELECT profile_id,enabled,weekly_goal,updated_at FROM score_settings ORDER BY profile_id').all(),
        game_profiles: db.prepare('SELECT * FROM game_profiles ORDER BY profile_id').all(),
        game_events: db.prepare('SELECT * FROM game_events ORDER BY id').all(),
        game_records: db.prepare('SELECT * FROM game_records ORDER BY profile_id,exercise_id').all(),
        pr_transactions: db.prepare('SELECT * FROM pr_transactions ORDER BY id').all(),
        user_achievements: db.prepare('SELECT * FROM user_achievements ORDER BY profile_id,unlocked_at,achievement_key').all(),
        user_items: db.prepare('SELECT * FROM user_items ORDER BY profile_id,acquired_at,item_key').all(),
        exercises: db.prepare('SELECT * FROM exercises ORDER BY id').all(),
        progress_entries: db.prepare('SELECT * FROM progress_entries ORDER BY id').all()
      };
    },

    importData(payload) {
      if (payload?.format !== 'gym-progress-backup' || !Array.isArray(payload.profiles) || !Array.isArray(payload.exercises) || !Array.isArray(payload.progress_entries)) {
        throw new Error('Nieprawidłowy format kopii zapasowej.');
      }
      db.exec('BEGIN IMMEDIATE');
      try {
        db.exec('DELETE FROM user_items; DELETE FROM user_achievements; DELETE FROM pr_transactions; DELETE FROM game_events; DELETE FROM game_records; DELETE FROM game_profiles; DELETE FROM score_settings; DELETE FROM progress_entries; DELETE FROM exercises; DELETE FROM profiles;');
        const profileInsert = db.prepare('INSERT INTO profiles(id,name,color,created_at) VALUES (?,?,?,?)');
        for (const x of payload.profiles) profileInsert.run(x.id, x.name, x.color, x.created_at);
        const scoreSettingsInsert=db.prepare('INSERT INTO score_settings(profile_id,enabled,weekly_goal,updated_at) VALUES(?,?,?,?)');
        for(const x of payload.score_settings||[])scoreSettingsInsert.run(x.profile_id,Number(Boolean(x.enabled)),Number(x.weekly_goal)||3,x.updated_at||new Date().toISOString());
        const gameProfileInsert=db.prepare(`INSERT INTO game_profiles(profile_id,enabled,avatar_configured,avatar_gender,skin_tone,eye_color,hairstyle,hair_color,back_style,top_style,bottom_style,shoes_style,headwear,accessory,total_xp,pr_balance,pr_total_earned,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`);
        for(const x of payload.game_profiles||[])gameProfileInsert.run(x.profile_id,Number(Boolean(x.enabled)),Number(Boolean(x.avatar_configured)),x.avatar_gender||null,x.skin_tone||null,x.eye_color||null,x.hairstyle||null,x.hair_color||null,x.back_style||'none',x.top_style||'cresci_tank',x.bottom_style||'training_shorts',x.shoes_style||'trainers',x.headwear||'none',x.accessory||'none',Math.max(0,Number(x.total_xp)||0),Math.max(0,Number(x.pr_balance)||0),Math.max(0,Number(x.pr_total_earned)||0),x.created_at||new Date().toISOString(),x.updated_at||new Date().toISOString());
        const exerciseInsert = db.prepare(`INSERT INTO exercises(id,name,category,load_mode,bar_weight,step_size,active,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?)`);
        for (const x of payload.exercises) exerciseInsert.run(x.id,x.name,x.category,x.load_mode,x.bar_weight,x.step_size,x.active,x.created_at,x.updated_at);
        const entryInsert = db.prepare(`INSERT INTO progress_entries(id,profile_id,exercise_id,performed_at,old_weight,new_weight,increment,plates_or_steps,change_type,change_label,note,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`);
        for (const x of payload.progress_entries) entryInsert.run(x.id,x.profile_id,x.exercise_id,x.performed_at,x.old_weight,x.new_weight,x.increment,x.plates_or_steps,x.change_type,x.change_label||'',x.note,x.created_at);
        const gameEventInsert=db.prepare(`INSERT INTO game_events(id,profile_id,event_type,event_key,xp_delta,pr_delta,metadata_json,occurred_at,created_at) VALUES(?,?,?,?,?,?,?,?,?)`);
        for(const x of payload.game_events||[])gameEventInsert.run(x.id,x.profile_id,x.event_type,x.event_key,Number(x.xp_delta)||0,Number(x.pr_delta)||0,x.metadata_json||'{}',x.occurred_at,x.created_at||new Date().toISOString());
        if(Array.isArray(payload.pr_transactions)){
          const transactionInsert=db.prepare(`INSERT INTO pr_transactions(id,profile_id,source_type,source_key,amount,balance_after,metadata_json,created_at) VALUES(?,?,?,?,?,?,?,?)`);
          for(const x of payload.pr_transactions)transactionInsert.run(x.id,x.profile_id,x.source_type,x.source_key,Number(x.amount)||0,Math.max(0,Number(x.balance_after)||0),x.metadata_json||'{}',x.created_at||new Date().toISOString());
        }else{
          db.exec(`INSERT OR IGNORE INTO pr_transactions(profile_id,source_type,source_key,amount,balance_after,metadata_json,created_at)
            SELECT event.profile_id,'RECORD',event.event_key,event.pr_delta,
              (SELECT COALESCE(SUM(previous.pr_delta),0) FROM game_events previous WHERE previous.profile_id=event.profile_id AND previous.event_type='personal_record' AND previous.pr_delta>0 AND (previous.occurred_at<event.occurred_at OR (previous.occurred_at=event.occurred_at AND previous.id<=event.id))),
              event.metadata_json,event.occurred_at FROM game_events event WHERE event.event_type='personal_record' AND event.pr_delta>0`);
        }
        const achievementInsert=db.prepare(`INSERT INTO user_achievements(profile_id,achievement_key,unlocked_at,reward_pr,reward_item_key,reward_item_granted,metadata_json) VALUES(?,?,?,?,?,?,?)`);
        for(const x of payload.user_achievements||[])achievementInsert.run(x.profile_id,x.achievement_key,x.unlocked_at,Math.max(0,Number(x.reward_pr)||0),x.reward_item_key||null,Number(Boolean(x.reward_item_granted)),x.metadata_json||'{}');
        if(Array.isArray(payload.user_items)){
          const itemInsert=db.prepare(`INSERT INTO user_items(profile_id,item_key,acquired_source,acquired_at,purchased_price,metadata_json) VALUES(?,?,?,?,?,?)`);
          for(const x of payload.user_items)itemInsert.run(x.profile_id,x.item_key,x.acquired_source||'RESTORE',x.acquired_at||new Date().toISOString(),Math.max(0,Number(x.purchased_price)||0),x.metadata_json||'{}');
        }else{
          db.exec(`INSERT OR IGNORE INTO user_items(profile_id,item_key,acquired_source,acquired_at,purchased_price)
            SELECT profile_id,top_style,'STARTER',created_at,0 FROM game_profiles WHERE avatar_configured=1 AND top_style<>'none'
            UNION ALL SELECT profile_id,bottom_style,'STARTER',created_at,0 FROM game_profiles WHERE avatar_configured=1 AND bottom_style<>'none'
            UNION ALL SELECT profile_id,shoes_style,'STARTER',created_at,0 FROM game_profiles WHERE avatar_configured=1 AND shoes_style<>'none'
            UNION ALL SELECT profile_id,headwear,'STARTER',created_at,0 FROM game_profiles WHERE avatar_configured=1 AND headwear<>'none'
            UNION ALL SELECT profile_id,accessory,'STARTER',created_at,0 FROM game_profiles WHERE avatar_configured=1 AND accessory<>'none'`);
        }
        if(Array.isArray(payload.game_records)){
          const recordInsert=db.prepare(`INSERT INTO game_records(profile_id,exercise_id,record_weight,last_source_entry_id,achieved_at,created_at,updated_at) VALUES(?,?,?,?,?,?,?)`);
          for(const x of payload.game_records)recordInsert.run(x.profile_id,x.exercise_id,Math.max(0,Number(x.record_weight)||0),x.last_source_entry_id||null,x.achieved_at||new Date().toISOString(),x.created_at||new Date().toISOString(),x.updated_at||new Date().toISOString());
        }else{
          db.exec(`INSERT INTO game_records(profile_id,exercise_id,record_weight,last_source_entry_id,achieved_at)
            SELECT pe.profile_id,pe.exercise_id,MAX(pe.new_weight),
              (SELECT source.id FROM progress_entries source WHERE source.profile_id=pe.profile_id AND source.exercise_id=pe.exercise_id ORDER BY source.new_weight DESC,source.performed_at,source.id LIMIT 1),
              (SELECT source.performed_at FROM progress_entries source WHERE source.profile_id=pe.profile_id AND source.exercise_id=pe.exercise_id ORDER BY source.new_weight DESC,source.performed_at,source.id LIMIT 1)
            FROM progress_entries pe GROUP BY pe.profile_id,pe.exercise_id`);
        }
        db.exec('COMMIT');
        return { profiles: payload.profiles.length, exercises: payload.exercises.length, entries: payload.progress_entries.length, score_settings:(payload.score_settings||[]).length, game_profiles:(payload.game_profiles||[]).length, game_events:(payload.game_events||[]).length, game_records:(payload.game_records||[]).length, pr_transactions:(payload.pr_transactions||[]).length, user_achievements:(payload.user_achievements||[]).length, user_items:(payload.user_items||[]).length };
      } catch (error) {
        db.exec('ROLLBACK');
        throw error;
      }
    }
  };
}
