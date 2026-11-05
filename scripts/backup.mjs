// Backup: copies every Firestore collection (with order lines) into one JSON file.
// Works on the free Spark plan; the managed "gcloud firestore export" needs Blaze.
//   npm run backup                -> backups/aitufood_YYYY-MM-DD_HHMM.json
import { mkdirSync, writeFileSync, statSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { Timestamp } from 'firebase-admin/firestore';
import { db, COLLECTIONS, projectId } from './admin.mjs';

function encode(value) {
  if (value instanceof Timestamp) return { __timestamp: value.toMillis() };
  if (Array.isArray(value)) return value.map(encode);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, encode(v)]));
  return value;
}

async function dumpCollection(ref) {
  const out = {};
  const snap = await ref.get();
  for (const doc of snap.docs) {
    const entry = { data: encode(doc.data()) };
    for (const sub of await doc.ref.listCollections()) entry[sub.id] = await dumpCollection(sub);
    out[doc.id] = entry;
  }
  return out;
}

async function main() {
  const stamp = new Date(Date.now() + 5 * 3600000).toISOString().slice(0, 16).replace('T', '_').replace(':', '');
  const backup = { createdAt: new Date().toISOString(), source: projectId, collections: {} };
  for (const name of COLLECTIONS) {
    backup.collections[name] = await dumpCollection(db.collection(name));
    console.log(`${name.padEnd(11)} ${Object.keys(backup.collections[name]).length} documents`);
  }
  mkdirSync('backups', { recursive: true });
  const file = `backups/aitufood_${stamp}.json`;
  const json = JSON.stringify(backup, null, 1);
  writeFileSync(file, json);
  const sha = createHash('sha256').update(json).digest('hex');
  console.log(`\nSaved ${file} (${(statSync(file).size / 1024).toFixed(0)} KB)`);
  console.log(`SHA-256 ${sha}`);
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
