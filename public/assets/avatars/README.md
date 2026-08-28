# CRESCI GAME — finalne sprite'y v8

Renderer używa niezmodyfikowanych assetów z dostarczonej paczki `cresci-avatar-assets-v8.zip`. Paczka deklaruje źródłowy canvas **256 × 384 px** i punkt zakotwiczenia `(128, 379)`. Wymiar 128 × 192 jest rozmiarem prezentacji w UI; pliki źródłowe nie zostały pomniejszone ani przetworzone.

## Struktura

```text
final-v8/
  female/{body,eyes,hair,bottom,top,shoes,headwear,accessories}/
  male/{body,eyes,hair,bottom,top,shoes,headwear,accessories}/
  source-manifest.json
  README.md
manifest.json
```

PNG są formatem kanonicznym. Każda warstwa ma ten sam canvas, pozycję i skalę. Renderer nakłada je zawsze w kolejności:

`body → eyes → hair → bottom → top → shoes → headwear → accessories`

CSS używa `image-rendering: pixelated` i nie skaluje warstw niezależnie.

## Dodawanie nowego itemu

1. Dodaj dostarczony sprite o identycznym canvasie do właściwego slotu osobno dla `female` i `male`, zachowując tę samą nazwę pliku.
2. Dodaj item do `src/game-items.js` z poprawnym `slot` oraz `spriteName`.
3. Dodaj mapowanie `key → spriteName` do właściwej warstwy w `manifest.json`.
4. Uruchom `npm test`; test integralności kontroluje canvas, kolejność warstw i niezmienione pliki finalnej paczki.

Nie należy przycinać, przeskalowywać, recolorować ani osobno pozycjonować pojedynczej warstwy.
