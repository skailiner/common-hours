import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import assert from 'node:assert/strict';
const root = process.cwd(),
  isPublic = process.argv.includes('--public'),
  skip = new Set(['node_modules', '.git', '.wrangler', '.vinext', '.next']);
const forbidden =
  /\b(?:sk-(?:proj-)?[A-Za-z0-9_-]{20,}|hf_[A-Za-z0-9]{20,}|ghp_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,})\b/;
const privatePattern =
  /(?:appgprj|appgver|appgdep)_[A-Za-z0-9]+|https:\/\/[a-z0-9-]+\.[a-z0-9-]+\.chatgpt\.site/;
let checked = 0;
function visit(dir) {
  for (const name of readdirSync(dir)) {
    if (
      skip.has(name) ||
      name === 'PRIVATE_RELEASE.md' ||
      name.endsWith('.tsbuildinfo')
    )
      continue;
    const path = join(dir, name),
      rel = relative(root, path);
    if (name.startsWith('.env'))
      throw new Error('Environment file must not be published: ' + rel);
    if (statSync(path).isDirectory()) {
      visit(path);
      continue;
    }
    if (!/\.(?:tsx?|m?js|json|html|rsc|md|css|svg|txt|yml|yaml)$/.test(name))
      continue;
    const text = readFileSync(path, 'utf8');
    assert.ok(!forbidden.test(text), 'Possible secret: ' + rel);
    if (isPublic)
      assert.ok(
        !privatePattern.test(text),
        'Private hosting reference: ' + rel,
      );
    checked++;
  }
}
visit(root);
const hosting = JSON.parse(readFileSync('.openai/hosting.json', 'utf8'));
assert.equal(hosting.static.directory, 'dist/client');
assert.equal(hosting.d1, null);
assert.equal(hosting.r2, null);
if (isPublic) assert.equal(hosting.project_id, undefined);
const html = readFileSync('dist/client/index.html', 'utf8');
assert.ok(html.includes('Common Hours'));
assert.ok(html.includes('Create draft plan'));
assert.ok(
  readdirSync('dist/client/_next/static').some((f) =>
    /^planner\.worker-.*\.js$/.test(f),
  ),
);
console.log(
  'Release check passed: ' +
    checked +
    ' text files; static entry, worker and ' +
    (isPublic ? 'public sanitization' : 'local release') +
    ' verified.',
);
