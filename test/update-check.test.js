import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { compareVersions, GitHubReleaseChecker, normalizeVersion } from '../src/update-check.js';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');

test('version normalization and comparison support GitHub v tags',()=>{
  assert.equal(normalizeVersion('v1.2.3').normalized,'1.2.3');
  assert.equal(compareVersions('1.0.1','v1.0.2'),-1);
  assert.equal(compareVersions('1.2.0','v1.1.9'),1);
  assert.equal(compareVersions('1.0.1','v1.0.1'),0);
  assert.throws(()=>normalizeVersion('main'),/Nieprawidłowy/);
});

test('release checker reports a newer public GitHub Release without executing updater',async()=>{
  let requested;
  const checker=new GitHubReleaseChecker({currentVersion:'1.0.1',fetchImpl:async(url,options)=>{requested={url,options};return{ok:true,json:async()=>({tag_name:'v1.0.2',name:'CRESCI 1.0.2',body:'Nowa sekcja aktualizacji.',html_url:'https://github.com/Tkoczu/Cresci/releases/tag/v1.0.2',published_at:'2026-08-29T12:00:00Z'})};}});
  const result=await checker.check();
  assert.equal(requested.url,'https://api.github.com/repos/Tkoczu/Cresci/releases/latest');
  assert.equal(result.current_version,'1.0.1');
  assert.equal(result.latest_version,'1.0.2');
  assert.equal(result.update_available,true);
  assert.equal(result.install_mode,'lxc-systemd-helper');
  assert.equal(result.install_command,'sudo cresci update');
});

test('release checker recognizes the current version and handles GitHub errors',async()=>{
  const current=new GitHubReleaseChecker({currentVersion:'1.0.1',fetchImpl:async()=>({ok:true,json:async()=>({tag_name:'v1.0.1',name:'CRESCI 1.0.1',body:''})})});
  assert.equal((await current.check()).update_available,false);
  const limited=new GitHubReleaseChecker({currentVersion:'1.0.1',fetchImpl:async()=>({ok:false,status:403})});
  await assert.rejects(()=>limited.check(),/ograniczył liczbę zapytań/);
});

test('release checker treats a missing public release as an empty state',async()=>{
  const checker=new GitHubReleaseChecker({currentVersion:'1.0.1',fetchImpl:async()=>({ok:false,status:404})});
  const result=await checker.check();
  assert.equal(result.current_version,'1.0.1');
  assert.equal(result.no_public_release,true);
  assert.equal(result.update_available,false);
  assert.equal(result.latest_version,null);
});

test('settings UI exposes update checking and delegates installation to the fixed system endpoint',()=>{
  const html=fs.readFileSync(path.join(root,'public','index.html'),'utf8');
  const app=fs.readFileSync(path.join(root,'public','app.js'),'utf8');
  const css=fs.readFileSync(path.join(root,'public','styles.css'),'utf8');
  const server=fs.readFileSync(path.join(root,'server.js'),'utf8');
  assert.match(html,/data-settings-tab="updates"/);
  assert.match(html,/id="checkUpdates"/);
  assert.match(html,/id="installUpdate"/);
  assert.match(app,/\/api\/updates\/check/);
  assert.match(app,/Brak połączenia z serwerem CRESCI/);
  assert.match(css,/\.update-install\[hidden\]\{display:none!important\}/);
  assert.match(server,/url\.pathname === '\/api\/version'/);
  assert.match(server,/url\.pathname === '\/api\/updates\/check'/);
  assert.match(app,/\/api\/system\/update/);
  assert.match(server,/\/api\/system\/update/);
  assert.doesNotMatch(server,/execFile|spawn\(|update\.sh/);
  assert.doesNotMatch(server,/\/api\/updates\/install/);
});

test('settings place GAME between general and backup without duplicating its controls',()=>{
  const html=fs.readFileSync(path.join(root,'public','index.html'),'utf8');
  const general=html.indexOf('data-settings-tab="general"');
  const game=html.indexOf('data-settings-tab="game"');
  const backup=html.indexOf('data-settings-tab="backup"');
  assert.ok(general>=0&&general<game&&game<backup);
  assert.match(html,/data-settings-panel="game"[\s\S]*?id="gameSettingsList"/);
  assert.equal((html.match(/id="gameSettingsList"/g)||[]).length,1);
});
