// 静的サイトを dist/ にコピーする(依存なし)
import { cpSync, rmSync, mkdirSync, existsSync } from 'node:fs';
rmSync('dist', { recursive: true, force: true });
mkdirSync('dist', { recursive: true });
cpSync('index.html', 'dist/index.html');
cpSync('src', 'dist/src', { recursive: true });
for (const f of ['index.html', 'src/lib.js', 'src/app.js']) {
  if (!existsSync(`dist/${f}`)) throw new Error(`missing ${f}`);
}
console.log('build ok -> dist/');
