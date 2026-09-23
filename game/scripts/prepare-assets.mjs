import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import crypto from 'node:crypto';
import sharp from 'sharp';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const refs = path.resolve(root, '../references');
const generated = path.join(root, 'public/generated');
const assets = path.join(root, 'public/assets');
await fs.mkdir(generated, { recursive: true });
await fs.mkdir(assets, { recursive: true });
const input = JSON.parse(await fs.readFile(path.join(refs, 'landmarks/landmarks_gta6.json'), 'utf8'));
const landmarks = input.filter(r => Number.isFinite(r.game_x) && Number.isFinite(r.game_y)).map(r => ({
  id: r.id, name: r.name === '?' ? r.ig_address?.split(',')[0] === '?' ? r.id : r.ig_address : r.name,
  region: r.region || 'Leonida', district: r.district || r.region || 'Leonida',
  x: r.game_x, z: -r.game_y, tags: r.tags || '',
  reference: r.ingame_photo || r.reallife_photo || '', confidence: 'community-mapped'
}));
const grouped = new Map();
for (const p of landmarks) {
  if (!grouped.has(p.region)) grouped.set(p.region, []);
  grouped.get(p.region).push(p);
}
const median = a => [...a].sort((a, b) => a - b)[Math.floor(a.length / 2)];
const regions = [...grouped].map(([name, pts]) => ({ name, x: median(pts.map(p => p.x)), z: median(pts.map(p => p.z)), count: pts.length }));
const world = {
  version: 1, units: 'metres', referenceAxes: 'X east, Y north; renderer Z = -reference Y',
  source: 'references/landmarks/landmarks_gta6.json', attribution: 'gtadb.org and all contributors — CC BY 4.0',
  geometryStatus: 'Landmark coordinates are sourced. Terrain elevation, shorelines, roads and architectural meshes are estimates pending tracing and authored replacement.',
  bounds: { minX: -11000, maxX: 4500, minZ: -10000, maxZ: 9000 },
  landmarks, regions
};
await fs.writeFile(path.join(generated, 'world.json'), JSON.stringify(world));
await fs.copyFile(path.join(refs, 'LICENSE-gtadb-data.txt'), path.join(generated, 'LICENSE-gtadb-data.txt'));
await sharp(path.join(refs, 'maps/leonida_yanis-16_z3.jpg')).resize({ width: 1400 }).webp({ quality: 85 }).toFile(path.join(generated, 'reference-map.webp'));
// This is a reference atlas, not a calibrated terrain texture. No copyrighted screenshots enter the build.
const manifest = [{ id: 'landmark-data', source: world.source, license: 'CC-BY-4.0', author: 'gtadb.org and all contributors', modifications: 'Filtered finite coordinates; north mapped to negative Z; compacted fields.' },
  { id: 'reference-atlas', source: 'references/maps/leonida_yanis-16_z3.jpg', license: 'CC-BY-4.0', author: 'gtadb.org and all contributors; Yanis', modifications: 'Resized and transcoded to WebP. Display-only; not used as an uncalibrated height field.' },
  { id: 'generated-environment', source: 'game/src/world and game/src/render', license: 'Project-authored', author: 'GTA-VI-Clone contributors', modifications: 'Original procedural architecture, street furniture, vehicles, vegetation and materials.' }];
async function download(url, destination, expectedBlob) {
  let bytes;
  try { bytes = await fs.readFile(destination); } catch { /* first build */ }
  const blobHash = b => crypto.createHash('sha1').update(`blob ${b.length}\0`).update(b).digest('hex');
  if (bytes && (!expectedBlob || blobHash(bytes) === expectedBlob)) return bytes;
  const res = await fetch(url, { signal: AbortSignal.timeout(45000), headers: { 'User-Agent': 'LeonidaBrowserAssetBuild/1.0' } });
  if (!res.ok) throw new Error(`${res.status}: ${url}`);
  bytes = Buffer.from(await res.arrayBuffer());
  if (bytes.length > 30 * 1024 * 1024) throw new Error('Asset exceeds 30 MB build budget');
  if (expectedBlob && blobHash(bytes) !== expectedBlob) throw new Error('Upstream asset changed; review source before updating its pinned hash');
  await fs.mkdir(path.dirname(destination), { recursive: true });
  await fs.writeFile(destination, bytes);
  return bytes;
}
const charBase = 'https://raw.githubusercontent.com/agentkaerf/FreeModels/main/Ultimate%20Modular%20Men-%20Feb%202022/';
const chars = [ ['casual', 'Casual_2', 'c40c07aee26776fc46c20c2a5d05460b1fcd4923'], ['beach', 'Beach', '2161dbab5ca3e866a32ec476803c0c0f589c5844'] ];
const available = { characters: [], textures: {} };
for (const [id, name, sha] of chars) {
  const url = `${charBase}Individual%20Characters/glTF/${name}.gltf`;
  try {
    const bytes = await download(url, path.join(assets, `${id}.gltf`), sha);
    const gltf = JSON.parse(bytes.toString());
    if ((gltf.buffers || []).some(b => b.uri && !b.uri.startsWith('data:'))) throw new Error('External glTF buffer must be explicitly packaged');
    if ((gltf.images || []).some(b => b.uri && !b.uri.startsWith('data:'))) throw new Error('External glTF image must be explicitly packaged');
    available.characters.push(id);
    manifest.push({ id, source: url, license: 'CC0-1.0', author: 'Quaternius', verifiedBlobSha: sha, modifications: 'None; runtime scaling and animation blending only.' });
    console.log(`${id}: ${bytes.length} bytes, animations: ${(gltf.animations || []).map(a => a.name).join(', ')}`);
  } catch (error) { console.warn(`Optional character ${id}: ${error.message}. Articulated original fallback remains available.`); }
}
await download(`${charBase}License.txt`, path.join(assets, 'LICENSE-Quaternius.txt'), '62341762fbd2f5eca68b8ab98d3ae1c4487087a1').catch(e => console.warn(e.message));
// Download at build time only. Play sessions never depend on a third-party CDN.
for (const id of ['aerial_asphalt_01', 'concrete_floor_worn_001']) {
  try {
    const response = await fetch(`https://api.polyhaven.com/files/${id}`, { signal: AbortSignal.timeout(15000) });
    if (!response.ok) throw new Error(`Poly Haven metadata: ${response.status}`);
    const spec = await response.json();
    const maps = {};
    for (const [channel, suffix] of [['diff', 'color'], ['nor_gl', 'normal'], ['rough', 'roughness']]) {
      const entry = spec[channel]?.['1k']?.jpg ?? spec[channel]?.['1k']?.png;
      if (!entry?.url) continue;
      const file = `${id}-${suffix}.jpg`;
      const bytes = await download(entry.url, path.join(assets, file));
      maps[suffix] = `assets/${file}`;
      manifest.push({ id: `${id}-${suffix}`, source: entry.url, license: 'CC0-1.0', author: 'Poly Haven contributors', sha256: crypto.createHash('sha256').update(bytes).digest('hex'), modifications: '1K runtime texture selection.' });
    }
    available.textures[id] = maps;
  } catch (error) { console.warn(`Optional texture ${id}: ${error.message}. Original procedural material remains available.`); }
}
await fs.writeFile(path.join(generated, 'assets.json'), JSON.stringify(available));
await fs.writeFile(path.join(generated, 'asset-manifest.json'), JSON.stringify(manifest, null, 2));
await fs.mkdir(path.join(root, 'artifacts/reference-audit'), { recursive: true });
for (const name of ['leonida_yanis-16_z3.jpg']) {
  await sharp(path.join(refs, 'maps', name)).resize({ width: 520 }).jpeg({ quality: 52 }).toFile(path.join(root, 'artifacts/reference-audit/map-preview.jpg'));
}
console.log(`Prepared ${landmarks.length} mapped landmarks, ${regions.length} regions. Assets: ${JSON.stringify(available)}`);
