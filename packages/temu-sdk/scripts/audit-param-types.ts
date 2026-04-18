#!/usr/bin/env tsx
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const RAW_DIR = path.join(__dirname, '..', 'spec', 'raw');
const seen = new Map<number, { count: number; samples: string[] }>();

function walk(arr: any[]) {
  for (const p of arr || []) {
    const pt = p.paramType;
    if (typeof pt === 'number') {
      const s = seen.get(pt) || { count: 0, samples: [] };
      s.count++;
      if (s.samples.length < 3) s.samples.push(`${p.paramName}: ${(p.desc || '').slice(0, 40)}`);
      seen.set(pt, s);
    }
    if (p.openParamList) walk(p.openParamList);
  }
}

for (const f of fs.readdirSync(RAW_DIR).filter(x => x.endsWith('.json'))) {
  const raw = JSON.parse(fs.readFileSync(path.join(RAW_DIR, f), 'utf-8'));
  if (raw?.interfaceDocument) {
    walk(raw.interfaceDocument.requestParam || []);
    walk(raw.interfaceDocument.responseParam || []);
    walk(raw.interfaceDocument.commonRequestParam || []);
  }
}
for (const [pt, s] of [...seen.entries()].sort((a, b) => a[0] - b[0])) {
  console.log(`paramType=${pt}: ${s.count} occurrences. samples: ${s.samples.join(' | ')}`);
}
