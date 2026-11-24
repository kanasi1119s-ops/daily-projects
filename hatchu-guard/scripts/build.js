import { cpSync, mkdirSync, rmSync, readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dist = join(root, 'dist');
rmSync(dist, { recursive: true, force: true });
mkdirSync(join(dist, 'src'), { recursive: true });
for (const f of ['index.html', 'style.css']) cpSync(join(root, f), join(dist, f));
for (const f of ['logic.js', 'app.js']) cpSync(join(root, 'src', f), join(dist, 'src', f));
for (const f of ['index.html', 'style.css', 'src/logic.js', 'src/app.js']) {
  if (!existsSync(join(dist, f))) throw new Error(`build failed: ${f} missing`);
}
if (!readFileSync(join(dist, 'index.html'), 'utf8').includes('src/app.js')) throw new Error('index.html does not load app.js');
console.log('build ok -> dist/');
