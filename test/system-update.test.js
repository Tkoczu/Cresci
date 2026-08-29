import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { SystemUpdateManager, systemUpdateConstants } from '../src/system-update.js';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const executableFs={statSync:()=>({isFile:()=>true}),accessSync:()=>{},readFileSync:()=>{throw new Error('missing');}};

test('system updater is unavailable outside the explicit production LXC contract',async()=>{
  let called=false;
  const manager=new SystemUpdateManager({appRoot:root,platform:'win32',uid:null,env:{NODE_ENV:'development'},fsImpl:executableFs,runCommand:async()=>{called=true;}});
  assert.equal(manager.status().available,false);
  await assert.rejects(()=>manager.start({targetVersion:'1.0.2'}),/tylko w produkcyjnej instalacji/);
  assert.equal(called,false);
});

test('production updater starts only the fixed helper and blocks duplicate requests',async()=>{
  let calls=0;
  const manager=new SystemUpdateManager({platform:'linux',uid:1001,env:{NODE_ENV:'production',CRESCI_UPDATE_ENABLED:'1'},fsImpl:executableFs,runCommand:async()=>{calls++;},now:()=>100000});
  const started=await manager.start({targetVersion:'1.0.2'});
  assert.equal(started.state,'queued');
  assert.equal(calls,1);
  await assert.rejects(()=>manager.start({targetVersion:'1.0.2'}),/już uruchomiona/);
  assert.equal(calls,1);
  assert.deepEqual(systemUpdateConstants,{APP_ROOT:'/opt/cresci',UPDATER:'/opt/cresci/scripts/update.sh',STATUS_FILE:'/var/lib/cresci-updater/status.json',SUDO:'/usr/bin/sudo',SYSTEMCTL:'/usr/bin/systemctl',UPDATE_UNIT:'cresci-update.service'});
});

test('status survives application restart and exposes rollback outcome',()=>{
  const payload={state:'failed',stage:'rollback',message:'Aktualizacja nie powiodła się.',rollback_succeeded:true,updated_at:'2026-08-29T12:00:00.000Z'};
  const manager=new SystemUpdateManager({platform:'linux',uid:1001,env:{NODE_ENV:'production',CRESCI_UPDATE_ENABLED:'1'},fsImpl:{...executableFs,readFileSync:()=>JSON.stringify(payload)},now:()=>Date.parse(payload.updated_at)+1000});
  assert.deepEqual(manager.status(),{available:true,reason:null,...payload});
});

test('server exposes fixed update endpoints without accepting commands or paths',()=>{
  const server=fs.readFileSync(path.join(root,'server.js'),'utf8');
  const manager=fs.readFileSync(path.join(root,'src','system-update.js'),'utf8');
  assert.match(server,/POST[^\n]+\/api\/system\/update/);
  assert.match(server,/GET[^\n]+\/api\/system\/update-status/);
  assert.doesNotMatch(server,/input\.command|input\.path|bodyJson\(req\).*system\/update/);
  assert.match(manager,/execFile\(SUDO,\[SYSTEMCTL,'start','--no-block',UPDATE_UNIT\]/);
  assert.doesNotMatch(manager,/\bshell\s*:/);
});

test('LXC integration keeps the web app unprivileged and fetches only a release tag',()=>{
  const updater=fs.readFileSync(path.join(root,'scripts','update.sh'),'utf8');
  const helper=fs.readFileSync(path.join(root,'scripts','install-update-helper.sh'),'utf8');
  const runner=fs.readFileSync(path.join(root,'scripts','update-runner.sh'),'utf8');
  const installer=fs.readFileSync(path.join(root,'scripts','install-proxmox.sh'),'utf8');
  assert.match(updater,/api\.github\.com\/repos\/\$\{REPO\}\/releases\/latest/);
  assert.match(updater,/fetch --force --no-tags "\$\{REPO_URL\}" "\+refs\/tags\/\$\{LATEST_VERSION\}:refs\/tags\/\$\{LATEST_VERSION\}"/);
  assert.doesNotMatch(updater,/checkout[^\n]+main|pull[^\n]+main/);
  assert.match(runner,/mktemp \/run\/cresci-update/);
  assert.match(helper,/cresci ALL=\(root\) NOPASSWD: \/usr\/bin\/systemctl start --no-block cresci-update\.service/);
  assert.match(helper,/User=cresci/);
  assert.match(installer,/User=cresci/);
  assert.doesNotMatch(installer,/User=root\n\n\[Install\]/);
});
