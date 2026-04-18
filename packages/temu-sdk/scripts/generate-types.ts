#!/usr/bin/env tsx
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SPEC_FILE = path.join(__dirname, '..', 'spec', 'temu-api-spec.json');
const OUT_FILE = path.join(__dirname, '..', 'src', 'generated', 'types.ts');

interface ApiParam {
  name: string;
  type: 'number' | 'string' | 'boolean' | 'object' | 'array';
  required: boolean;
  desc: string;
  children?: ApiParam[] | null;
}
interface ApiSpec {
  interfaceType: string;
  interfaceName: string;
  interfaceDesc: string;
  requestParams: ApiParam[];
  responseParams: ApiParam[];
}

function toPascalCase(s: string): string {
  return s
    .split(/[.\-_]/)
    .filter(Boolean)
    .map((w) => w[0]!.toUpperCase() + w.slice(1))
    .join('');
}

function escapeComment(text: string): string {
  // escape */ and trim length
  return (text || '').replace(/\*\//g, '*\\/').replace(/\n/g, ' ').slice(0, 300);
}

function renderType(p: ApiParam, indent: number): string {
  const ind = ' '.repeat(indent);
  switch (p.type) {
    case 'number':
      return 'number';
    case 'boolean':
      return 'boolean';
    case 'string':
      return 'string';
    case 'array': {
      const kids = p.children || [];
      if (!kids.length) return 'unknown[]';
      const itemParam = kids.find((c) => c.name === '$item') ?? kids[0]!;
      // If the item is an object with inline fields, render as Array<{ ... }>
      if (itemParam.type === 'object' && itemParam.children && itemParam.children.length) {
        const fields = itemParam.children.map((c) => renderField(c, indent + 2)).join('\n');
        return `Array<{\n${fields}\n${ind}}>`;
      }
      return `${renderType(itemParam, indent)}[]`;
    }
    case 'object': {
      const kids = p.children || [];
      if (!kids.length) return 'Record<string, unknown>';
      const fields = kids.map((c) => renderField(c, indent + 2)).join('\n');
      return `{\n${fields}\n${ind}}`;
    }
    default:
      return 'unknown';
  }
}

function renderField(p: ApiParam, indent: number): string {
  const ind = ' '.repeat(indent);
  const comment = p.desc ? `${ind}/** ${escapeComment(p.desc)} */\n` : '';
  const optional = p.required ? '' : '?';
  // Sanitize property names: wrap in quotes if not a valid identifier
  const nameSafe = /^[A-Za-z_$][\w$]*$/.test(p.name) ? p.name : JSON.stringify(p.name);
  return `${comment}${ind}${nameSafe}${optional}: ${renderType(p, indent)};`;
}

const spec = JSON.parse(fs.readFileSync(SPEC_FILE, 'utf-8')) as { specs: ApiSpec[] };

const out: string[] = [
  '// AUTO-GENERATED — do not edit by hand',
  '// Run `pnpm codegen` to regenerate.',
  '',
];

const seenNames = new Set<string>();
for (const s of spec.specs) {
  const base = toPascalCase(s.interfaceType);
  if (seenNames.has(base)) {
    console.warn(`Duplicate name ${base} for ${s.interfaceType} — skipping`);
    continue;
  }
  seenNames.add(base);
  out.push(`// ${s.interfaceType} — ${s.interfaceName}`);
  out.push(`export interface ${base}Request {`);
  for (const p of s.requestParams) {
    out.push(renderField(p, 2));
  }
  out.push('}');
  out.push(`export interface ${base}Response {`);
  for (const p of s.responseParams) {
    out.push(renderField(p, 2));
  }
  out.push('}');
  out.push('');
}

fs.mkdirSync(path.dirname(OUT_FILE), { recursive: true });
fs.writeFileSync(OUT_FILE, out.join('\n'));
console.log(`wrote ${OUT_FILE} (${seenNames.size} unique interfaces)`);
