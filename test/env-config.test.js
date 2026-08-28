import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { updateGoogleEnv } from '../src/env-config.js';

test('OAuth wizard updates only Google values and preserves other env settings',()=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'cresci-env-test-')),file=path.join(root,'.env');
  try{
    fs.writeFileSync(file,'PORT=5555\n# moje ustawienie\nGOOGLE_CLIENT_ID="old.apps.googleusercontent.com"\n','utf8');
    updateGoogleEnv(file,{GOOGLE_CLIENT_ID:'new.apps.googleusercontent.com',GOOGLE_CLIENT_SECRET:'secret-value',GOOGLE_REDIRECT_URI:'http://localhost:4173/api/google-drive/callback'});
    const result=fs.readFileSync(file,'utf8');
    assert.match(result,/PORT=5555/);assert.match(result,/# moje ustawienie/);assert.match(result,/GOOGLE_CLIENT_ID="new\.apps\.googleusercontent\.com"/);assert.match(result,/GOOGLE_CLIENT_SECRET="secret-value"/);assert.match(result,/GOOGLE_REDIRECT_URI=/);
  }finally{fs.rmSync(root,{recursive:true,force:true});}
});
