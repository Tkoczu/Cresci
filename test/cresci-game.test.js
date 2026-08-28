import test from 'node:test';
import assert from 'node:assert/strict';
import { levelFromXp, validateAvatar } from '../src/cresci-game.js';

test('level curve is deterministic and exposes progress within current level',()=>{
  assert.deepEqual(levelFromXp(0),{level:1,total_xp:0,current_xp:0,required_xp:100,progress_percent:0});
  assert.deepEqual(levelFromXp(100),{level:2,total_xp:100,current_xp:0,required_xp:125,progress_percent:0});
  assert.equal(levelFromXp(224).level,2);assert.equal(levelFromXp(225).level,3);
});

test('avatar accepts only supported options',()=>{
  const avatar=validateAvatar({gender:'female',skin_tone:'deep',eye_color:'blue',hairstyle:'bun',hair_color:'black'});
  assert.equal(avatar.hairstyle,'bun');assert.equal(avatar.top_style,'cresci_tank');assert.equal(avatar.accessory,'none');
  assert.throws(()=>validateAvatar({gender:'robot'}),/wszystkie opcje/);
  assert.throws(()=>validateAvatar({top_style:'armor'}),/wszystkie opcje/);
});
