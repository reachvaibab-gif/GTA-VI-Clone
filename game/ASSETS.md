# Runtime asset policy

Run `npm run assets` from `game/` after installing dependencies. This packages only selected assets into `public/`; Vite never publishes the entire `references/` directory.

- **GTADB**: finite landmark coordinates and the Yanis reference atlas from the existing repository, CC BY 4.0. Credit: **gtadb.org and all contributors**. The atlas is explicitly display-only until its tile origin is calibrated. It is not a terrain height map.
- **Quaternius Ultimate Modular Men**: Casual_2 and Beach characters, CC0 1.0. Source license: https://quaternius.com/packs/ultimatemodularcharacters.html and the license shipped with the pack. Distribution mirror: agentkaerf/FreeModels. Downloads are verified against pinned Git blob hashes. Characters are visibly stylized and remain below the intended final art target.
- **Poly Haven**: selected 1K asphalt and concrete PBR maps, CC0. Downloaded at build time with exact URLs and SHA-256 hashes written to `public/generated/asset-manifest.json`. Missing optional downloads are recorded, not disguised as loaded assets.
- **Project-authored**: generated building modules, façade layouts, palms, vehicles, street furniture, water and procedural textures.

Rockstar screenshots, wiki screenshots, key art, music and trailer clips stay in the private reference library. None are used as shipped runtime textures, promotional screenshots, models or audio. The reference library is not evidence of permission to redistribute every depicted asset.

One runtime world unit equals one reference game unit, approximately one metre. Preserving coordinate scale does **not** establish accurate coastlines, elevations, road geometry, building shapes or complete GTA VI coverage. Those require their own reference comparisons and authored replacements.
