# GTA VI reference library

Open `index.html` in a browser to browse everything (search, filters, full-size viewer, in-game vs real-life toggle).

| Folder | Contents |
|---|---|
| `official_rockstar/` | 168 official images from rockstargames.com/VI at 3840x2160: places, characters, Ultimate Edition, Vintage Vice City Pack, key art |
| `maps/` | Full Leonida maps stitched from gtadb.org tiles (Yanis V16 up to 10752px, Dupzor v0.051, RickRick Vice City V3 at 12800px, martipk, aiwe), relief maps, and an annotated map with every landmark ID |
| `maps/areas_hires/` | 25 area crops at 1 pixel per game unit (about 1 m), good for tracing top-down pixel art |
| `landmarks/` | 3,498 gtadb.org landmark photos (2,132 in-game, 1,366 real-life) sorted by region, plus `landmarks_gta6.csv/json` with names, game coordinates, real addresses, lat/lng and tags |
| `wiki_gta6/` | 1,078 GTA Wiki images: Trailer 1 and 2 frames, 157 vehicle crops, weapons, 700+ storefront/brand/sign crops, two official character videos |
| `screenshots/gtadb_guessr/` | 25 located frames from the gtadb guessing game |
| `gtadb_site/` | gtadb banners and area images |
| `game_info/` | `GTA6_game_info.md` (facts, characters, places, systems, sources), `wiki_lists.json` (269 vehicles, 36 weapons, 193 brands, 31 characters, 21 animals, locations), colour palettes from the official screenshots |

Map coordinates: game (0,0) is the map centre, X east, Y north. For a map stitched at zoom z, pixels per game unit = 2^z / 32 (z4 = 0.5, z5 = 1).
Pixel x = (X + 16384) * scale - originTileX * 256, pixel y = (16384 - Y) * scale - originTileY * 256.

Rebuild the page data after adding files: `python3 _tools/build_catalog.py` (thumbnails live in `_thumbs/`).

Licences: gtadb.org landmark data, photos and map tiles are CC BY 4.0 (credit "gtadb.org and all contributors", see `LICENSE-gtadb-data.txt`). Rockstar screenshots and wiki images are Rockstar Games property, kept here as private reference only.
