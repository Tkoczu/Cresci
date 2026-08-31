import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { openDatabase, createRepository } from '../src/db.js';
import { passwordDigest, passwordMatches } from '../src/auth.js';

function freshDatabase() {
  const directory=fs.mkdtempSync(path.join(os.tmpdir(),'cresci-auth-'));
  const db=openDatabase(path.join(directory,'test.sqlite'),{seedProfiles:false});
  return {directory,db,repo:createRepository(db),close(){db.close();fs.rmSync(directory,{recursive:true,force:true});}};
}

test('fresh installation requires the first account and optional passwords are hashed',()=>{
  const fixture=freshDatabase();
  try{
    assert.deepEqual(fixture.repo.accountUsers(),[]);
    const digest=passwordDigest('bezpieczne hasło');
    const user=fixture.repo.createAccount({name:'Marek',color:'#ff5d45',...digest});
    assert.equal(user.password_required,true);
    const stored=fixture.repo.accountUser(user.id);
    assert.notEqual(stored.password_hash,'bezpieczne hasło');
    assert.equal(passwordMatches('bezpieczne hasło',stored.password_salt,stored.password_hash),true);
    assert.equal(passwordMatches('złe',stored.password_salt,stored.password_hash),false);
  }finally{fixture.close();}
});

test('deleting an account removes all user-owned data and leaves shared exercises',()=>{
  const fixture=freshDatabase();
  try{
    const user=fixture.repo.createAccount({name:'Domi',color:'#7c6df2'});
    const exercise=fixture.repo.bootstrap().exercises[0];
    fixture.repo.addEntry({profile_id:user.id,exercise_id:exercise.id,new_weight:40,performed_at:'2026-08-31'});
    fixture.db.prepare('INSERT INTO score_settings(profile_id,enabled,weekly_goal) VALUES(?,?,?)').run(user.id,1,3);
    assert.equal(fixture.repo.deleteAccount(user.id),true);
    assert.equal(fixture.db.prepare('SELECT COUNT(*) count FROM profiles').get().count,0);
    assert.equal(fixture.db.prepare('SELECT COUNT(*) count FROM progress_entries').get().count,0);
    assert.equal(fixture.db.prepare('SELECT COUNT(*) count FROM score_settings').get().count,0);
    assert.ok(fixture.db.prepare('SELECT COUNT(*) count FROM exercises').get().count>0);
  }finally{fixture.close();}
});

test('one backup preserves accounts and password hashes but never active sessions',()=>{
  const source=freshDatabase(),target=freshDatabase();
  try{
    const digest=passwordDigest('sekret'),user=source.repo.createAccount({name:'Marek',color:'#ff5d45',...digest});
    source.repo.createAuthSession(user.id,'hashed-session-token','2099-01-01T00:00:00.000Z');
    const backup=source.repo.exportData();
    assert.equal(backup.profiles[0].password_hash,digest.password_hash);
    assert.equal('auth_sessions' in backup,false);
    target.repo.importData(backup);
    const restored=target.repo.accountUser(user.id);
    assert.equal(passwordMatches('sekret',restored.password_salt,restored.password_hash),true);
    assert.equal(target.db.prepare('SELECT COUNT(*) count FROM auth_sessions').get().count,0);
  }finally{source.close();target.close();}
});

test('authenticated bootstrap exposes only the selected user and their weights',()=>{
  const fixture=freshDatabase();
  try{
    const marek=fixture.repo.createAccount({name:'Marek',color:'#ff5d45'}),domi=fixture.repo.createAccount({name:'Domi',color:'#7c6df2'});
    const exercise=fixture.repo.bootstrap().exercises[0];
    const marekEntry=fixture.repo.addEntry({profile_id:marek.id,exercise_id:exercise.id,new_weight:80,performed_at:'2026-08-30'});
    const domiEntry=fixture.repo.addEntry({profile_id:domi.id,exercise_id:exercise.id,new_weight:45,performed_at:'2026-08-31'});
    const view=fixture.repo.bootstrap(marek.id),weight=view.exercises.find(item=>item.id===exercise.id).profile_weights;
    assert.deepEqual(view.profiles.map(user=>user.id),[marek.id]);
    assert.deepEqual(weight.map(item=>({profile_id:item.profile_id,weight:item.weight})),[{profile_id:marek.id,weight:80}]);
    assert.equal(view.stats.entries,1);
    assert.equal(fixture.repo.entryBelongsTo(marekEntry.id,marek.id),true);
    assert.equal(fixture.repo.entryBelongsTo(domiEntry.id,marek.id),false);
  }finally{fixture.close();}
});
