#!/usr/bin/env tsx
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SPEC_FILE = path.join(__dirname, '..', 'spec', 'temu-api-spec.json');
const OUT_FILE = path.join(__dirname, '..', 'src', 'generated', 'methods.ts');

interface ApiSpec {
  interfaceType: string;
  interfaceName: string;
  requestUrl: string;
  region: 'cn' | 'pa';
}

function toPascalCase(s: string): string {
  return s.split(/[.\-_]/).filter(Boolean).map((w) => w[0].toUpperCase() + w.slice(1)).join('');
}
function toCamelCase(s: string): string {
  const p = toPascalCase(s);
  return p[0].toLowerCase() + p.slice(1);
}

const spec = JSON.parse(fs.readFileSync(SPEC_FILE, 'utf-8')) as { specs: ApiSpec[] };

const out: string[] = [
  '// AUTO-GENERATED — do not edit by hand',
  '// Run `pnpm codegen` to regenerate.',
  '',
  "import type * as T from './types';",
  "import { callTemuApi, type TemuCallContext } from '../http-client';",
  '',
];

const seenMethodNames = new Set<string>();
const seenInterfaceTypes = new Set<string>();
const registry: string[] = [];

for (const s of spec.specs) {
  if (seenInterfaceTypes.has(s.interfaceType)) continue;
  seenInterfaceTypes.add(s.interfaceType);

  const base = toPascalCase(s.interfaceType);
  const methodName = toCamelCase(s.interfaceType);
  if (seenMethodNames.has(methodName)) continue;
  seenMethodNames.add(methodName);

  out.push(`// ${s.interfaceType} — ${s.interfaceName}`);
  out.push(`export async function ${methodName}(ctx: TemuCallContext, req: T.${base}Request): Promise<T.${base}Response> {`);
  out.push(`  return callTemuApi<T.${base}Request, T.${base}Response>(ctx, {`);
  out.push(`    interfaceType: '${s.interfaceType}',`);
  out.push(`    region: '${s.region}',`);
  out.push(`    requestUrl: '${s.requestUrl}',`);
  out.push(`  }, req);`);
  out.push(`}`);
  out.push('');

  registry.push(`  '${s.interfaceType}': { region: '${s.region}', requestUrl: '${s.requestUrl}', interfaceName: ${JSON.stringify(s.interfaceName)} },`);
}

out.push(`// TOTAL_METHODS: ${seenMethodNames.size}`);
out.push(`export const TEMU_API_REGISTRY: Record<string, { region: string; requestUrl: string; interfaceName: string }> = {`);
out.push(...registry);
out.push('};');

fs.mkdirSync(path.dirname(OUT_FILE), { recursive: true });
fs.writeFileSync(OUT_FILE, out.join('\n'));
console.log(`wrote ${OUT_FILE} (${seenMethodNames.size} methods)`);
