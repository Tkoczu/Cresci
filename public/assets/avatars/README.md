# CRESCI Avatar v4-production

Jedynym aktywnym źródłem grafik jest `v4-production/`, rozpakowane bez modyfikacji z `cresci-avatar-hd-creator-shop-v4-production.zip`.

- `v4-production/manifest.json` — 996 assetów, hashe, canvasy, kotwice i kolejność warstw,
- `v4-production/creator/catalog.json` — warianty skóry, oczu i włosów,
- `v4-production/shop/catalog.json` — SKU i grafiki produktów,
- `runtime` 512 × 768 — główny ekran Postać,
- `compact` 256 × 384 — kreator, inventory, sklep i miniatury,
- `master` 1024 × 1536 — wyłącznie materiał źródłowy.

Renderer wybiera PNG i dodaje `?v=4` do każdego żądania. Wszystkie warstwy jednego avatara pochodzą z tej samej rozdzielczości, zaczynają się w `(0,0)` i są nakładane w kolejności:

`back → body → eyes → hair → bottom → top → shoes → headwear → accessories`

Nie stosujemy osobnych przesunięć, skalowania warstw, filtrów, kadrowania ani wygładzania. Poprzednie katalogi mogą pozostać na dysku jako nieaktywne archiwum, ale kod aplikacji, aktywny manifest i żądania HTTP nie odwołują się do nich.
