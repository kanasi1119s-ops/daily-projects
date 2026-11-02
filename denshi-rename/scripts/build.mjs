import { cpSync, rmSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dist = join(root, 'dist');
rmSync(dist, { recursive: true, force: true });
mkdirSync(dist, { recursive: true });
for (const f of ['index.html', 'style.css', 'app.js', 'src']) cpSync(join(root, f), join(dist, f), { recursive: true });
console.log('built ->', dist);
