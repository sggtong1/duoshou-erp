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
