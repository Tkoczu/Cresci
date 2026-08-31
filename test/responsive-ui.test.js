import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');

test('sidebar navigation remains scrollable in a short window',()=>{
  const css=fs.readFileSync(path.join(root,'public','styles.css'),'utf8');
  assert.match(css,/\.sidebar\{overflow:hidden\}/);
  assert.match(css,/\.sidebar nav\{[^}]*flex:1 1 auto[^}]*min-height:0[^}]*overflow-y:auto/);
  assert.match(css,/overscroll-behavior:contain/);
});

test('shop exposes client-side search and slot filters',()=>{
  const html=fs.readFileSync(path.join(root,'public','index.html'),'utf8');
  const app=fs.readFileSync(path.join(root,'public','app.js'),'utf8');
  assert.match(html,/id="shopSearch"[^>]*type="search"/);
  assert.match(html,/id="shopFilters"/);
  assert.match(app,/shopFilter:'all'/);
  assert.match(app,/normalizedShopText/);
  assert.match(app,/item\.slot!==state\.shopFilter/);
  assert.match(app,/data-shop-slot/);
  assert.match(app,/Nie znaleziono przedmiotów pasujących do wybranych filtrów/);
});
