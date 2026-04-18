import { describe, it, expect, beforeAll } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const typesFile = path.join(__dirname, '..', 'src', 'generated', 'types.ts');

describe('codegen: types', () => {
  beforeAll(() => {
    // Run codegen before assertions
    execSync('pnpm tsx scripts/generate-types.ts', { cwd: path.join(__dirname, '..'), stdio: 'inherit' });
  });

  it('types.ts exists after codegen', () => {
    expect(fs.existsSync(typesFile)).toBe(true);
  });

  it('generates a Request type for bg.goods.add', () => {
    const content = fs.readFileSync(typesFile, 'utf-8');
    expect(content).toMatch(/export interface BgGoodsAddRequest/);
    expect(content).toMatch(/export interface BgGoodsAddResponse/);
  });

  it('generates types for bg.mall.info.get (simpler interface)', () => {
    const content = fs.readFileSync(typesFile, 'utf-8');
    expect(content).toMatch(/export interface BgMallInfoGetRequest/);
    expect(content).toMatch(/export interface BgMallInfoGetResponse/);
  });

  it('nested object params produce inline nested types', () => {
    const content = fs.readFileSync(typesFile, 'utf-8');
    // productSemiManagedReq is a nested object in bg.goods.add per Temu docs
    expect(content).toMatch(/productSemiManagedReq\??: /);
  });

  it('contains export interface for at least 150 Request types', () => {
    const content = fs.readFileSync(typesFile, 'utf-8');
    const matches = content.match(/export interface \w+Request/g) || [];
    expect(matches.length).toBeGreaterThanOrEqual(150);
  });

  it('output passes tsc --noEmit', () => {
    // Use the package tsconfig; generated/ is inside src/ so it's included
    const result = execSync('npx tsc --noEmit -p tsconfig.json 2>&1 || true', {
      cwd: path.join(__dirname, '..'),
    }).toString();
    // Allow 0 errors; any "error TS" is a fail
    expect(result).not.toMatch(/error TS/);
  });
});

describe('codegen: methods', () => {
  const methodsFile = path.join(__dirname, '..', 'src', 'generated', 'methods.ts');

  beforeAll(() => {
    execSync('pnpm tsx scripts/generate-methods.ts', { cwd: path.join(__dirname, '..'), stdio: 'inherit' });
  });

  it('methods.ts exists after codegen', () => {
    expect(fs.existsSync(methodsFile)).toBe(true);
  });

  it('exports TEMU_API_REGISTRY with 150+ entries', () => {
    const content = fs.readFileSync(methodsFile, 'utf-8');
    expect(content).toMatch(/export const TEMU_API_REGISTRY/);
    const match = content.match(/\/\/ TOTAL_METHODS: (\d+)/);
    expect(match).toBeTruthy();
    expect(parseInt(match![1], 10)).toBeGreaterThanOrEqual(150);
  });

  it('each registry entry has interfaceType, region, requestUrl', () => {
    const content = fs.readFileSync(methodsFile, 'utf-8');
    expect(content).toMatch(/'bg\.goods\.add': \{ region: 'cn', requestUrl: '\/openapi\/router'/);
    expect(content).toMatch(/'bg\.glo\.goods\.add': \{ region: 'pa'/);
  });

  it('generates camelCase function names', () => {
    const content = fs.readFileSync(methodsFile, 'utf-8');
    // bg.mall.info.get -> bgMallInfoGet
    expect(content).toMatch(/export async function bgMallInfoGet/);
    expect(content).toMatch(/export async function bgGoodsAdd/);
  });

  it('output compiles with tsc --noEmit', () => {
    const result = execSync('npx tsc --noEmit -p tsconfig.json 2>&1 || true', {
      cwd: path.join(__dirname, '..'),
    }).toString();
    expect(result).not.toMatch(/error TS/);
  });
});
