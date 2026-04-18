#!/usr/bin/env tsx
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SPEC_DIR = path.join(__dirname, '..', 'spec', 'raw');
const LEAVES_FILE = path.join(__dirname, '..', '..', '..', 'docs', 'references', 'temu', '_leaves.json');
const HUBSTUDIO_API = 'http://127.0.0.1:6873';
const CONTAINER_CODE = 1281770282;

interface Leaf { documentId: number; directoryId: number; name: string; path: string }

async function startBrowser(): Promise<string> {
  const r = await fetch(`${HUBSTUDIO_API}/api/v1/browser/start`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ containerCode: CONTAINER_CODE }),
  });
  const j = await r.json() as any;
  if (j.code !== 0) throw new Error(`HubStudio start failed: ${JSON.stringify(j)}`);
  return j.data.debuggingPort as string;
}

async function main() {
  fs.mkdirSync(SPEC_DIR, { recursive: true });
  const leaves: Leaf[] = JSON.parse(fs.readFileSync(LEAVES_FILE, 'utf-8'));
  console.log(`leaves: ${leaves.length}`);

  const port = await startBrowser();
  console.log(`browser CDP port: ${port}`);

  const browser = await chromium.connectOverCDP(`http://127.0.0.1:${port}`);
  const ctx = browser.contexts()[0];
  const page = await ctx.newPage();
  const client = await ctx.newCDPSession(page);
  await client.send('Network.enable');

  let antiContent = '', orgId = '';
  client.on('Network.requestWillBeSent', (e: any) => {
    if (e.request.url.includes('erebus-partner/document/')) {
      const h = e.request.headers;
      antiContent = h['Anti-Content'] || h['anti-content'] || antiContent;
      orgId = h['orgId'] || h['orgid'] || orgId;
    }
  });

  await page.goto('https://agentpartner.temu.com/document?cataId=875198836203', { waitUntil: 'networkidle', timeout: 60000 });
  await page.waitForTimeout(2500);
  if (!antiContent || !orgId) throw new Error('failed to capture Anti-Content/orgId headers');
  console.log(`anti-content captured: ${antiContent.slice(0, 20)}... orgId=${orgId}`);

  let ok = 0, skipped = 0, fail = 0;
  for (const leaf of leaves) {
    const outFile = path.join(SPEC_DIR, `${leaf.documentId}.json`);
    if (fs.existsSync(outFile) && fs.statSync(outFile).size > 100) { skipped++; continue; }
    try {
      const d = await page.evaluate(async ({ id, ac, oi }: any) => {
        const r = await fetch('https://agentpartner.temu.com/erebus-partner/document/queryDocumentDetail', {
          method: 'POST', credentials: 'include',
          headers: { 'Content-Type': 'application/json', 'Anti-Content': ac, 'orgId': oi },
          body: JSON.stringify({ id }),
        });
        return await r.json();
      }, { id: leaf.documentId, ac: antiContent, oi: orgId });
      if (d?.result) {
        fs.writeFileSync(outFile, JSON.stringify(d.result, null, 2));
        ok++;
      } else {
        fail++;
        console.warn(`no result for ${leaf.documentId} (${leaf.name})`);
      }
    } catch (e: any) {
      fail++;
      console.error(`error ${leaf.documentId}: ${e.message}`);
    }
    if ((ok + fail) % 25 === 0) console.log(`progress: ok=${ok} skip=${skipped} fail=${fail}`);
    await new Promise(r => setTimeout(r, 50));
  }

  console.log(`\nDONE ok=${ok} skipped=${skipped} fail=${fail}`);
  await browser.close();
}

main().catch(e => { console.error(e); process.exit(1); });
