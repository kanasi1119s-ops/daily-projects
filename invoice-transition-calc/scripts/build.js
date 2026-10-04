// 静的ファイルを dist/ にまとめる(依存なし)。ロジックは src/calc.js を共有コピーする。
import { cpSync, mkdirSync, rmSync } from 'node:fs';
rmSync('dist', { recursive: true, force: true });
mkdirSync('dist', { recursive: true });
cpSync('public', 'dist', { recursive: true });
cpSync('src/calc.js', 'dist/calc.js');
console.log('built: dist/');
