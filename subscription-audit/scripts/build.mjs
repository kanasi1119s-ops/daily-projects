// 依存なしの静的ビルド: 配布物を dist/ にコピーする
import { cpSync, rmSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dist = join(root, 'dist');
rmSync(dist, { recursive: true, force: true });
mkdirSync(dist, { recursive: true });
for (const f of ['index.html', 'privacy.html', 'style.css', 'src']) cpSync(join(root, f), join(dist, f), { recursive: true });
console.log('built ->', dist);
