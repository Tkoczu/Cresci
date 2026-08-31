import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { GAME_ITEMS, gameItems } from '../src/game-items.js';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const assets=path.join(root,'public','assets','avatars');
const packRoot=path.join(assets,'v4-production');
const manifest=JSON.parse(fs.readFileSync(path.join(packRoot,'manifest.json'),'utf8'));
const creator=JSON.parse(fs.readFileSync(path.join(packRoot,'creator','catalog.json'),'utf8'));
const shop=JSON.parse(fs.readFileSync(path.join(packRoot,'shop','catalog.json'),'utf8'));

test('v4-production is the only active avatar contract',()=>{
  assert.equal(manifest.packId,'cresci-avatar-hd-creator-shop-v4-production');
  assert.equal(manifest.schemaVersion,'4.1.0');
  assert.equal(manifest.defaultResolution,'runtime');
  assert.deepEqual(manifest.layerOrder,['back','body','eyes','hair','bottom','top','shoes','headwear','accessories']);
  assert.deepEqual(manifest.variants.runtime,{width:512,height:768,anchor:{name:'feet-center',x:256,y:758}});
  assert.deepEqual(manifest.variants.compact,{width:256,height:384,anchor:{name:'feet-center',x:128,y:379}});
  assert.deepEqual(manifest.variants.master,{width:1024,height:1536,anchor:{name:'feet-center',x:512,y:1516}});
});

test('all supplied and manager-added layer assets retain hashes, dimensions and RGBA PNG',()=>{
  assert.ok(manifest.assets.length>=996);
  for(const asset of manifest.assets){
    const file=fs.readFileSync(path.join(packRoot,asset.path));
    assert.equal(crypto.createHash('sha256').update(file).digest('hex'),asset.sha256,asset.path);
    if(asset.format==='png'){
      assert.equal(file.readUInt32BE(16),asset.canvas.width,`${asset.path} width`);
      assert.equal(file.readUInt32BE(20),asset.canvas.height,`${asset.path} height`);
      assert.equal(file[25],6,`${asset.path} must use RGBA`);
    }
  }
});

test('creator and shop catalogs resolve only files supplied by v4-production',()=>{
  assert.equal(creator.schemaVersion,'2.0.0');
  assert.equal(shop.schemaVersion,'3.0.0');
  assert.equal(creator.hairStyles.male.length,5);
  assert.equal(creator.hairStyles.female.length,5);
  assert.ok(shop.items.length>=70);
  for(const resolution of ['master','runtime','compact'])for(const gender of ['male','female']){
    const variants=creator.variantsByResolution[resolution][gender];
    for(const body of Object.values(variants.body))assert.ok(fs.existsSync(path.join(packRoot,body.png)));
    for(const eyes of Object.values(variants.eyes))assert.ok(fs.existsSync(path.join(packRoot,eyes.png)));
    for(const style of Object.values(variants.hair))for(const hair of Object.values(style))assert.ok(fs.existsSync(path.join(packRoot,hair.png)));
  }
  for(const item of shop.items)for(const resolution of ['master','runtime','compact'])assert.ok(fs.existsSync(path.join(packRoot,item.assets[resolution].png)),`${item.sku} ${resolution}`);
  const managedIds=new Set(shop.items.filter(item=>item.managedBy==='cresci-manager').map(item=>item.contentId));
  for(const contentId of managedIds){
    const variants=shop.items.filter(item=>item.contentId===contentId);
    assert.ok(variants.length>=1,`${contentId} variants`);
    assert.ok(gameItems().some(item=>item.key===contentId),`${contentId} must be exposed by the CRESCI shop API`);
  }
});

test('shared renderer selects runtime or compact and puts every layer at 0,0',()=>{
  const app=fs.readFileSync(path.join(root,'public','app.js'),'utf8');
  assert.match(app,/AVATAR_ASSET_ROOT='\/assets\/avatars\/v4-production'/);
  assert.match(app,/AVATAR_CACHE_VERSION='4\.1'/);
  assert.match(app,/creator\/catalog\.json\?v=/);
  assert.match(app,/shop\/catalog\.json\?v=/);
  assert.match(app,/spriteManifest\.layerOrder\.map/);
  assert.match(app,/class="avatar-layer avatar-layer-\$\{layer\}"/);
  assert.match(app,/sizeClass\?spriteManifest\.compactResolution/);
  assert.match(app,/Math\.min\(stage\.clientWidth\/width,stage\.clientHeight\/height\)/);
  assert.doesNotMatch(app,/standard-v3|hd-proof-v2|final-v21/);
  assert.doesNotMatch(app,/spriteLayerOffset|layer-offset-y/);
});

test('CSS uses contain and one common canvas without filters or per-layer transforms',()=>{
  const styles=fs.readFileSync(path.join(root,'public','styles.css'),'utf8');
  assert.match(styles,/\.avatar-layer\{position:absolute;inset:0;width:100%;height:100%/);
  assert.match(styles,/\.avatar-layer\{[^}]*object-fit:contain/);
  assert.match(styles,/\.avatar-layer\{[^}]*image-rendering:pixelated;image-rendering:crisp-edges/);
  const rule=styles.match(/\.avatar-layer\{[^}]*\}/)?.[0]||'';
  assert.doesNotMatch(rule,/filter:|drop-shadow|transform:|outline:/);
  assert.match(styles,/\.avatar-canvas\{[^}]*transform:translateX\(-50%\) scale\(var\(--avatar-scale,1\)\)/);
});

test('existing item keys and purchases map to v4 PNG sprite names without changing IDs',()=>{
  const pngPaths=new Set(manifest.assets.filter(asset=>asset.format==='png').map(asset=>asset.path));
  const mapped=GAME_ITEMS.filter(item=>item.spriteName);
  assert.ok(mapped.length>=40);
  for(const item of mapped)for(const gender of ['male','female'])for(const resolution of ['runtime','compact']){
    const file=`${gender}/${resolution}/${item.slot}/${item.spriteName}.png`;
    assert.ok(pngPaths.has(file),`${item.key} -> ${file}`);
  }
  assert.equal(new Set(GAME_ITEMS.map(item=>item.key)).size,GAME_ITEMS.length);
  assert.equal(GAME_ITEMS.find(item=>item.key==='orange_hoodie').spriteName,'orange_pullover_hoodie');
  assert.equal(GAME_ITEMS.find(item=>item.key==='power_crop').spriteName,'black_performance_tank');
});

test('no service worker or active source references an older avatar pack',()=>{
  const files=['public/app.js','public/styles.css','public/index.html','server.js'];
  for(const file of files){
    const content=fs.readFileSync(path.join(root,file),'utf8');
    assert.doesNotMatch(content,/standard-v3|hd-proof-v2|final-v21/);
    assert.doesNotMatch(content,/navigator\.serviceWorker|serviceWorker\.register/);
  }
  const index=fs.readFileSync(path.join(root,'public','index.html'),'utf8');
  assert.match(index,/styles\.css\?v=4\.2/);
  assert.match(index,/app\.js\?v=4\.2/);
});
