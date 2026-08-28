import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { openDatabase } from '../src/db.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const db = openDatabase(path.join(root, 'data', 'gym-progress.sqlite'));

const exercises = [
  ['Triceps', 'Triceps', 'steps', 0, 5],
  ['Biceps', 'Biceps', 'steps', 0, 5],
  ['Przyciąganie linki wyciągu dolnego w siadzie płaskim (Seated Cable Row)', 'Plecy', 'steps', 0, 7],
  ['Przyciąganie do brody (Lat pulldown)', 'Plecy', 'steps', 0, 7],
  ['Rozpiętki (Pec Dec)', 'Klatka piersiowa', 'steps', 0, 7],
  ['Supine press (ciężar na stronę)', 'Klatka piersiowa', 'direct', 0, 5],
  ['Seated hip adduction (Ściskanie nóg)', 'Nogi — przywodziciele', 'steps', 0, 7],
  ['Seated Hip Abduction (Rozkraczanie nóg)', 'Nogi — odwodziciele', 'steps', 0, 7],
  ['Seated Leg Curl (Zginanie nóg)', 'Nogi — dwugłowe uda', 'steps', 0, 7],
  ['Suwnica', 'Nogi', 'plates', 0, 5],
  ['Suwnica (ciężar na stronę)', 'Nogi', 'direct', 0, 5],
  ['Leg Press', 'Nogi', 'plates', 0, 5],
  ['Bułgarski martwy ciąg', 'Nogi', 'direct', 0, 1],
  ['Siady', 'Nogi', 'direct', 0, 1]
];

// Kolejność jak w tabeli użytkownika: od najnowszych do najstarszych.
const rows = [
  ['2026-08-21','Triceps','Marek',0,41,41,'1','Dołożenie krążka'],
  ['2026-08-21','Przyciąganie linki wyciągu dolnego w siadzie płaskim (Seated Cable Row)','Domii',1,39,38,'2','Dołożenie krążka'],
  ['2026-08-21','Seated hip adduction (Ściskanie nóg)','Marek',79,86,7,'2','Zmiana ciężaru'],
  ['2026-08-21','Supine press (ciężar na stronę)','Marek',0,20,20,'','Zmiana ciężaru'],
  ['2026-08-21','Suwnica (ciężar na stronę)','Domii',10,15,5,'','Zmiana ciężaru'],
  ['2026-08-19','Triceps','Domii',0,32,32,'1','Dołożenie krążka'],
  ['2026-08-19','Rozpiętki (Pec Dec)','Domii',32,39,7,'1','Zmiana ciężaru'],
  ['2026-08-09','Suwnica','Marek',0,40,40,'','Zmiana ciężaru'],
  ['2026-08-09','Suwnica (ciężar na stronę)','Domii',0,10,10,'','Zmiana ciężaru'],
  ['2026-07-29','Triceps','Marek',36,41,5,'2','Zmiana ciężaru'],
  ['2026-07-29','Triceps','Domii',27,32,5,'2','Zmiana ciężaru'],
  ['2026-07-29','Biceps','Marek',27,32,5,'2','Zmiana ciężaru'],
  ['2026-07-29','Biceps','Domii',0,23,23,'1','Dołożenie krążka'],
  ['2026-07-24','Przyciąganie linki wyciągu dolnego w siadzie płaskim (Seated Cable Row)','Domii',0,39,39,'1','Dołożenie krążka'],
  ['2026-07-10','Biceps','Domii',18,23,5,'2','Zmiana ciężaru'],
  ['2026-07-10','Przyciąganie do brody (Lat pulldown)','Domii',1,32,31,'2','Dołożenie krążka'],
  ['2026-07-10','Seated Hip Abduction (Rozkraczanie nóg)','Domii',52,59,7,'2','Zmiana ciężaru'],
  ['2026-07-10','Seated Hip Abduction (Rozkraczanie nóg)','Marek',0,66,66,'1','Dołożenie krążka'],
  ['2026-07-10','Seated hip adduction (Ściskanie nóg)','Marek',1,79,78,'2','Dołożenie krążka'],
  ['2026-07-10','Seated hip adduction (Ściskanie nóg)','Domii',1,39,38,'2','Dołożenie krążka'],
  ['2026-07-10','Rozpiętki (Pec Dec)','Marek',59,66,7,'1','Zmiana ciężaru'],
  ['2026-06-21','Triceps','Marek',1,36,35,'2','Dołożenie krążka'],
  ['2026-06-21','Triceps','Domii',1,27,26,'2','Dołożenie krążka'],
  ['2026-06-21','Biceps','Domii',0,18,18,'2','Dołożenie krążka'],
  ['2026-06-21','Biceps','Marek',1,27,26,'2','Dołożenie krążka'],
  ['2026-06-21','Przyciąganie linki wyciągu dolnego w siadzie płaskim (Seated Cable Row)','Domii',32,39,7,'2','Zmiana ciężaru'],
  ['2026-06-04','Przyciąganie linki wyciągu dolnego w siadzie płaskim (Seated Cable Row)','Marek',52,59,7,'2','Zmiana ciężaru'],
  ['2026-06-04','Przyciąganie linki wyciągu dolnego w siadzie płaskim (Seated Cable Row)','Marek',0,59,59,'2','Dołożenie krążka'],
  ['2026-06-04','Seated hip adduction (Ściskanie nóg)','Marek',0,79,79,'1','Dołożenie krążka'],
  ['2026-06-04','Seated Hip Abduction (Rozkraczanie nóg)','Domii',45,52,7,'2','Zmiana ciężaru'],
  ['2026-06-04','Seated hip adduction (Ściskanie nóg)','Domii',0,39,39,'1','Dołożenie krążka'],
  ['2026-06-04','Przyciąganie do brody (Lat pulldown)','Marek',1,59,58,'2','Dołożenie krążka'],
  ['2026-05-31','Przyciąganie linki wyciągu dolnego w siadzie płaskim (Seated Cable Row)','Marek',0,52,52,'1','Dołożenie krążka'],
  ['2026-05-31','Przyciąganie linki wyciągu dolnego w siadzie płaskim (Seated Cable Row)','Marek',1,52,51,'2','Dołożenie krążka'],
  ['2026-05-31','Przyciąganie linki wyciągu dolnego w siadzie płaskim (Seated Cable Row)','Domii',1,32,31,'2','Dołożenie krążka'],
  ['2026-05-31','Seated hip adduction (Ściskanie nóg)','Domii',32,39,7,'2','Zmiana ciężaru'],
  ['2026-05-31','Przyciąganie do brody (Lat pulldown)','Marek',0,59,59,'1','Dołożenie krążka'],
  ['2026-05-31','Biceps','Marek',0,27,27,'1','Dołożenie krążka'],
  ['2026-05-28','Seated hip adduction (Ściskanie nóg)','Marek',73,79,6,'0','Zmiana ciężaru'],
  ['2026-05-10','Triceps','Domii',0,27,27,'1','Dołożenie krążka'],
  ['2026-05-10','Przyciąganie linki wyciągu dolnego w siadzie płaskim (Seated Cable Row)','Domii',0,32,32,'1','Dołożenie krążka'],
  ['2026-05-10','Seated Hip Abduction (Rozkraczanie nóg)','Domii',39,45,6,'2','Zmiana ciężaru'],
  ['2026-05-10','Przyciąganie do brody (Lat pulldown)','Domii',25,32,7,'1','Zmiana ciężaru'],
  ['2026-05-06','Bułgarski martwy ciąg','Marek',0,10,10,'','Zmiana ciężaru'],
  ['2026-05-06','Bułgarski martwy ciąg','Domii',0,5,5,'','Zmiana ciężaru'],
  ['2026-05-06','Siady','Marek',0,10,10,'','Zmiana ciężaru'],
  ['2026-05-06','Siady','Domii',0,8,8,'','Zmiana ciężaru'],
  ['2026-05-06','Seated Leg Curl (Zginanie nóg)','Domii',32,39,7,'0','Zmiana ciężaru'],
  ['2026-05-06','Seated Leg Curl (Zginanie nóg)','Marek',45,59,14,'0','Zmiana ciężaru'],
  ['2026-05-03','Triceps','Marek',32,36,4,'1','Zmiana ciężaru'],
  ['2026-05-03','Seated Hip Abduction (Rozkraczanie nóg)','Marek',59,66,7,'0','Zmiana ciężaru'],
  ['2026-05-03','Przyciąganie do brody (Lat pulldown)','Marek',52,59,7,'0','Zmiana ciężaru'],
  ['2026-05-01','Seated hip adduction (Ściskanie nóg)','Marek',66,73,7,'0','Zmiana ciężaru'],
  ['2026-05-01','Seated Hip Abduction (Rozkraczanie nóg)','Domii',39,39,0,'2','Dołożenie krążka'],
  ['2026-05-01','Seated hip adduction (Ściskanie nóg)','Domii',32,32,0,'2','Dołożenie krążka'],
  ['2026-05-01','Biceps','Marek',23,27,4,'1','Zmiana ciężaru'],
  ['2026-05-01','Przyciąganie do brody (Lat pulldown)','Marek',45,52,7,'1','Zmiana ciężaru'],
  ['2026-05-01','Leg Press','Domii',0,10,10,'0','Zmiana ciężaru'],
  ['2026-05-01','Rozpiętki (Pec Dec)','Domii',32,32,0,'1','Dołożenie krążka']
];

db.exec('PRAGMA foreign_keys=ON; BEGIN IMMEDIATE');
try {
  const profileIds = Object.fromEntries(db.prepare('SELECT id,name FROM profiles').all().map(x => [x.name, x.id]));
  db.exec('DELETE FROM progress_entries; DELETE FROM exercises;');
  const insertExercise = db.prepare('INSERT INTO exercises(name,category,load_mode,bar_weight,step_size) VALUES (?,?,?,?,?)');
  const exerciseIds = {};
  for (const exercise of exercises) exerciseIds[exercise[0]] = Number(insertExercise.run(...exercise).lastInsertRowid);
  const insertEntry = db.prepare(`
    INSERT INTO progress_entries(profile_id,exercise_id,performed_at,old_weight,new_weight,increment,plates_or_steps,change_type,change_label,note,created_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?)
  `);
  for (const [date,exercise,personRaw,oldWeight,newWeight,increment,plates,label] of [...rows].reverse()) {
    const person = personRaw === 'Domi' ? 'Domii' : personRaw;
    const changeType = increment > 0 ? 'increase' : increment < 0 ? 'decrease' : 'repeat';
    insertEntry.run(profileIds[person],exerciseIds[exercise],date,oldWeight,newWeight,increment,plates,changeType,label,'Import z historii użytkownika',`${date} 12:00:00`);
  }
  db.exec('COMMIT; PRAGMA optimize;');
  console.log(JSON.stringify({ exercises: exercises.length, entries: rows.length, profiles: Object.keys(profileIds).length }));
} catch (error) {
  db.exec('ROLLBACK');
  throw error;
} finally {
  db.close();
}
