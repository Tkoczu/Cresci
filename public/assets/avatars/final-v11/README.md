# CRESCI GAME Avatar Assets v11 — Horizontally Aligned Hair

All equipable layers are derived from one dressed master per gender and share a 256×384 canvas with feet-center anchor `(128,379)`.

Render order: `body → eyes → hair → bottom → top → shoes → headwear → accessories`.

Never auto-trim or independently scale a layer. Draw every selected PNG at the same x/y and size. PNG is canonical; WebP is lossless. The `previews/*_locked_master.png` files are QA targets, while `*_layered.png` files are the actual layer compositions.
