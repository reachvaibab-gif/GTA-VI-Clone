// Bounded private-repository evidence mirror. No source references, secrets or dependencies are published.
import fs from 'node:fs/promises';
import path from 'node:path';
const token = process.env.GITHUB_TOKEN, repo = process.env.GITHUB_REPOSITORY;
if (!token || !repo || process.env.GITHUB_EVENT_NAME !== 'push' || process.env.GITHUB_REF !== 'refs/heads/main') process.exit(0);
const branch = 'build-evidence';
const api = async (route, method = 'GET', body) => {
  const r = await fetch(`https://api.github.com/repos/${repo}/${route}`, {
    method, headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json', 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body)
  });
  if (!r.ok) throw new Error(`Evidence API ${route}: ${r.status}`);
  return r.json();
};
const root = path.resolve('artifacts');
const allowed = ['reference-audit/map-preview.jpg', 'reference-audit/audit.json', 'playtest/report.json', 'playtest/street.jpg', 'playtest/driving.jpg', 'playtest/aerial.jpg', 'playtest/night.jpg', 'playtest/menu.jpg', 'playtest/preview.jpg'];
const tree = [];
for (const file of allowed) {
  let bytes;
  try { bytes = await fs.readFile(path.join(root, file)); } catch { continue; }
  if (bytes.length > 2 * 1024 * 1024) throw new Error(`Evidence file too large: ${file}`);
  const blob = await api('git/blobs', 'POST', { encoding: 'base64', content: bytes.toString('base64') });
  tree.push({ path: file, mode: '100644', type: 'blob', sha: blob.sha });
}
if (!tree.length) process.exit(0);
const readme = `# Build verification evidence\n\nSource commit: ${process.env.GITHUB_SHA}\nRun: ${process.env.GITHUB_RUN_ID}\n\nThis private branch contains bounded test reports and screenshots only. It is not a deployment or a completion claim.\n`;
const blob = await api('git/blobs', 'POST', { encoding: 'utf-8', content: readme });
tree.push({ path: 'README.md', mode: '100644', type: 'blob', sha: blob.sha });
const newTree = await api('git/trees', 'POST', { tree });
let parent;
try { parent = (await api(`git/ref/heads/${branch}`)).object.sha; } catch { /* first evidence commit */ }
const commit = await api('git/commits', 'POST', { message: `test evidence for ${process.env.GITHUB_SHA.slice(0, 7)}`, tree: newTree.sha, parents: parent ? [parent] : [] });
await api(parent ? `git/refs/heads/${branch}` : 'git/refs', parent ? 'PATCH' : 'POST', parent ? { sha: commit.sha, force: false } : { ref: `refs/heads/${branch}`, sha: commit.sha });
console.log(`Evidence saved to ${branch}, commit ${commit.sha}`);
