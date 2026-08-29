# CRESCI GAME Avatar Assets v18 — Creator + Shop

This pack contains the complete character-creator matrix and the three v15 shop collections.

Creator options: gender, 6 skin tones, 4 eye colors, 5 hairstyles per gender and 6 hair colors. Creator options are free appearance settings and are defined in `creator/catalog.json`. Shop wearables remain defined in `shop/catalog.json`.

Every layer uses the same transparent 256×384 canvas and feet-center anchor `(128,379)`. Never auto-trim, independently resize or reposition a layer. Render order: `body → eyes → hair → bottom → top → shoes → headwear → accessories`.

The selected hair asset is resolved from `gender + hairStyle + hairColor`; skin and eye choices map directly to their respective paths in the creator catalog.
