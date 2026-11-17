// 静的サイトなのでビルドは dist/ へのコピーのみ。
import { cp, rm, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
const root = join(fileURLToPath(new URL('.', import.meta.url)), '..');
await rm(join(root, 'dist'), { recursive: true, force: true });
await mkdir(join(root, 'dist'), { recursive: true });
for (const f of ['index.html', 'style.css', 'src', 'privacy.html']) await cp(join(root, f), join(root, 'dist', f), { recursive: true });
console.log('built dist/');
