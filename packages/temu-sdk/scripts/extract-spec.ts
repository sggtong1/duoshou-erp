#!/usr/bin/env tsx
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const RAW_DIR = path.join(__dirname, '..', 'spec', 'raw');
const OUT_FILE = path.join(__dirname, '..', 'spec', 'temu-api-spec.json');
const LEAVES_FILE = path.join(__dirname, '..', '..', '..', 'docs', 'references', 'temu', '_leaves.json');

interface ApiParam {
  name: string;
  type: 'number' | 'string' | 'boolean' | 'object' | 'array';
  required: boolean;
  desc: string;
  children?: ApiParam[];
}

interface ApiSpec {
  interfaceType: string;
  interfaceName: string;
  interfaceDesc: string;
  requestUrl: string;
  region: 'cn' | 'pa' | 'both';
  group: string;
  requestParams: ApiParam[];
  responseParams: ApiParam[];
  commonRequestParams: ApiParam[];
}

function mapParamType(pt: number): ApiParam['type'] {
  // paramType enum (confirmed by audit script):
  // 1 = number, 2 = boolean, 4 = string, 5 = boolean (alt), 6 = object, 7 = object (map/dict), 8 = array
  switch (pt) {
    case 1: return 'number';
    case 2: return 'boolean';
    case 4: return 'string';
    case 5: return 'boolean';
    case 6: return 'object';
    case 7: return 'object';
    case 8: return 'array';
    default: return 'object';
  }
}

function normalizeParams(raw: any[]): ApiParam[] {
  return (raw || []).map((p) => ({
    name: p.paramName || p.name || '',
    type: mapParamType(p.paramType),
    required: !!p.required,
    desc: p.desc || '',
    children: p.openParamList ? normalizeParams(p.openParamList) : undefined,
  }));
}

function inferRegion(interfaceType: string, leafPath: string): ApiSpec['region'] {
  if (interfaceType.startsWith('bg.glo.') || interfaceType.startsWith('bg.btg.') || interfaceType.startsWith('bg.qtg.')) return 'pa';
  if (leafPath.includes('-PA')) return 'pa';
  return 'cn';
}

function inferGroup(p: string): string {
  const m = p.match(/API文档 \/ ([^/]+)/);
  return m ? m[1] : 'unknown';
}

const leaves: any[] = JSON.parse(fs.readFileSync(LEAVES_FILE, 'utf-8'));
const specs: ApiSpec[] = [];
const skipped: Array<{ documentId: number; reason: string; name: string }> = [];

for (const leaf of leaves) {
  const rawFile = path.join(RAW_DIR, `${leaf.documentId}.json`);
  if (!fs.existsSync(rawFile)) {
    skipped.push({ documentId: leaf.documentId, reason: 'raw file missing', name: leaf.name });
    continue;
  }
  const raw = JSON.parse(fs.readFileSync(rawFile, 'utf-8'));
  const ifDoc = raw?.interfaceDocument;
  if (!ifDoc || !ifDoc.interfaceType) {
    skipped.push({ documentId: leaf.documentId, reason: 'no interfaceDocument', name: leaf.name });
    continue;
  }
  specs.push({
    interfaceType: ifDoc.interfaceType,
    interfaceName: ifDoc.interfaceName || '',
    interfaceDesc: ifDoc.interfaceDesc || '',
    requestUrl: ifDoc.requestUrl || '/openapi/router',
    region: inferRegion(ifDoc.interfaceType, leaf.path),
    group: inferGroup(leaf.path),
    requestParams: normalizeParams(ifDoc.requestParam),
    responseParams: normalizeParams(ifDoc.responseParam),
    commonRequestParams: normalizeParams(ifDoc.commonRequestParam),
  });
}

fs.writeFileSync(OUT_FILE, JSON.stringify({
  generated_at: new Date().toISOString(),
  count: specs.length,
  skipped,
  specs,
}, null, 2));
console.log(`extracted ${specs.length} specs, skipped ${skipped.length}`);
