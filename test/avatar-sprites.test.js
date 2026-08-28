import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const assets=path.join(root,'public','assets','avatars');

test('sprite manifest defines identical layered canvases for female and male bases',()=>{
  const manifest=JSON.parse(fs.readFileSync(path.join(assets,'manifest.json'),'utf8'));
  assert.deepEqual(manifest.canvas,{width:256,height:384});
  assert.deepEqual(manifest.displayCanvas,{width:128,height:192});
  assert.deepEqual(manifest.layerOrder,['body','eyes','hair','bottom','top','shoes','headwear','accessories']);
  assert.deepEqual(manifest.bases,['female','male']);
  for(const base of manifest.bases)for(const layer of manifest.layerOrder)assert.equal(fs.statSync(path.join(assets,'final-v8',base,layer)).isDirectory(),true);
});

test('final v8 PNG files keep the supplied bytes and common 256x384 canvas',()=>{
  const root=path.join(assets,'final-v8');
  const source=JSON.parse(fs.readFileSync(path.join(root,'source-manifest.json'),'utf8'));
  const pngAssets=source.assets.filter(item=>item.format==='png');
  assert.equal(pngAssets.length,16);
  for(const item of pngAssets){
    const file=fs.readFileSync(path.join(root,item.path));
    assert.equal(crypto.createHash('sha256').update(file).digest('hex'),item.sha256,item.path);
    assert.equal(file.readUInt32BE(16),256,`${item.path} width`);
    assert.equal(file.readUInt32BE(20),384,`${item.path} height`);
  }
});

test('avatar renderer uses raster sprite layers instead of SVG character drawing',()=>{
  const app=fs.readFileSync(path.join(root,'public','app.js'),'utf8');
  assert.match(app,/data-sprite-layer/);assert.match(app,/spriteManifest\.layerOrder/);
  assert.match(app,/function itemAvatar\(/);assert.match(app,/itemAvatar\(item/);
  assert.doesNotMatch(app,/avatarSvg|<svg class="game-avatar"/);
});

test('CSS keeps headwear above hair and every avatar layer on its manifest level',()=>{
  const styles=fs.readFileSync(path.join(root,'public','styles.css'),'utf8');
  const order=['body','eyes','hair','bottom','top','shoes','headwear','accessories'];
  order.forEach((layer,index)=>assert.match(styles,new RegExp(`\\.sprite-layer-${layer}\\{z-index:${index+1}!important\\}`)));
  assert.doesNotMatch(styles,/\.sprite-layer[^}]*mix-blend-mode/);
  assert.doesNotMatch(styles,/\.sprite-layer[^}]*filter:/);
});
