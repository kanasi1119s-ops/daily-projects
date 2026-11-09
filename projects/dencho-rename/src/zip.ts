import { zipSync } from 'fflate';

/** ブラウザ内でZIP化（外部送信なし） */
export async function makeZip(files: { name: string; data: Uint8Array }[], csv: string): Promise<Blob> {
  const tree: Record<string, Uint8Array> = {};
  const enc = new TextEncoder();
  for (const f of files) tree[f.name] = f.data;
  tree['索引簿.csv'] = enc.encode(csv);
  const out = zipSync(tree, { level: 0 });
  return new Blob([out as BlobPart], { type: 'application/zip' });
}
