import { cp, mkdir, rm } from 'node:fs/promises';
const out = new URL('../dist/', import.meta.url);
await rm(out, { recursive: true, force: true });
await mkdir(out, { recursive: true });
for (const f of ['index.html', 'style.css', 'src']) await cp(new URL('../' + f, import.meta.url), new URL(f, out), { recursive: true });
console.log('dist/ を生成しました');
