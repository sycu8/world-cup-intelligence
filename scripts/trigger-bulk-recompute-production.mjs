#!/usr/bin/env node
/**
 * Trigger production bulk WC2026 recompute via KV flag + model queue.
 * Usage: node scripts/trigger-bulk-recompute-production.mjs [reason]
 */
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const tokenPath = resolve(root, 'cf-deploy.token');
const token = existsSync(tokenPath)
  ? readFileSync(tokenPath, 'utf8').trim()
  : process.env.CLOUDFLARE_API_TOKEN?.trim();

if (!token) {
  console.error('Missing CLOUDFLARE_API_TOKEN / cf-deploy.token');
  process.exit(1);
}

const accountId = '4c15704ef706b9c8954cd6f9feb678d8';
const kvNamespaceId = 'fe99c19c60a542ea9771111b5ae050da';
const modelQueueId = '9a7617d18ff24993ae08e60d7e7a75c9';
const reason = process.argv[2] ?? 'manual-bulk-recompute';

const headers = {
  Authorization: `Bearer ${token}`,
  'Content-Type': 'application/json',
};

const kvRes = await fetch(
  `https://api.cloudflare.com/client/v4/accounts/${accountId}/storage/kv/namespaces/${kvNamespaceId}/values/bulk_recompute_wc2026`,
  { method: 'PUT', headers: { Authorization: `Bearer ${token}` }, body: reason },
);
const kvJson = await kvRes.json();
if (!kvJson.success) {
  console.error('KV put failed', kvJson);
  process.exit(1);
}

const qRes = await fetch(
  `https://api.cloudflare.com/client/v4/accounts/${accountId}/queues/${modelQueueId}/messages`,
  {
    method: 'POST',
    headers,
    body: JSON.stringify({ body: { type: 'recompute_wc2026_bulk', reason } }),
  },
);
const qJson = await qRes.json();
if (!qJson.success) {
  console.error('Queue send failed', qJson);
  process.exit(1);
}

console.log(JSON.stringify({ ok: true, reason, queue: qJson.result?.metadata }, null, 2));
