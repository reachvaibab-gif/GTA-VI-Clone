import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../references');
const out = path.resolve('artifacts/reference-audit');
await fs.mkdir(out, { recursive: true });
const walk = async dir => (await Promise.all((await fs.readdir(dir, { withFileTypes: true })).map(async e => e.isDirectory() ? walk(path.join(dir, e.name)) : path.join(dir, e.name)))).flat();
const files = await walk(root);
const records = JSON.parse(await fs.readFile(path.join(root, 'landmarks/landmarks_gta6.json'), 'utf8'));
const list = Array.isArray(records) ? records : records.landmarks ?? records.features ?? Object.values(records);
const samples = list.slice(0, 3);
const report = { files: files.length, landmarkRecords: list.length, samples,
  regions: [...new Set(list.map(r => r.region))],
  tools: files.filter(f => f.includes('/_tools/')).map(f => path.relative(root, f)),
  maps: [] };
for (const f of files.filter(f => f.includes('/maps/') && !f.includes('/areas_hires/') && /\.(jpg|png)$/.test(f))) {
  const meta = await sharp(f).metadata();
  report.maps.push({ file: path.relative(root, f), width: meta.width, height: meta.height });
  if (/yanis-16_z2|GTA6Relief/.test(f)) await sharp(f).resize({ width: 1800, withoutEnlargement: true }).png().toFile(path.join(out, path.basename(f).replace(/\.[^.]+$/, '.png')));
}
const official = files.filter(f => f.includes('/official_rockstar/') && /\.(jpg|png|webp)$/.test(f));
report.officialSamples = official.slice(0, 15).map(f => path.relative(root, f));
report.landmarkBounds = { minX: Math.min(...list.map(r => Number(r.game_x)).filter(Number.isFinite)), maxX: Math.max(...list.map(r => Number(r.game_x)).filter(Number.isFinite)), minY: Math.min(...list.map(r => Number(r.game_y)).filter(Number.isFinite)), maxY: Math.max(...list.map(r => Number(r.game_y)).filter(Number.isFinite)) };
await fs.writeFile(path.join(out, 'audit.json'), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
await fs.copyFile(path.join(root, 'landmarks/landmarks_gta6.csv'), path.join(out, 'landmarks.csv'));
for (const f of files.filter(f => f.includes('/_tools/') && /\.(py|json|md)$/.test(f))) await fs.copyFile(f, path.join(out, path.basename(f)));
