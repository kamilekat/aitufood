// Restore: puts Firestore back exactly as it was in a backup JSON file.
//   npm run restore -- backups/aitufood_2026-10-14_1530.json
// The collections in the file are deleted first, then every document is written back.
import { readFileSync } from 'node:fs';
import { Timestamp } from 'firebase-admin/firestore';
import { db, projectId } from './admin.mjs';

function decode(value) {
  if (Array.isArray(value)) return value.map(decode);
  if (value && typeof value === 'object') {
    if ('__timestamp' in value) return Timestamp.fromMillis(value.__timestamp);
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, decode(v)]));
  }
  return value;
}

function collectWrites(ref, docs, writes) {
  for (const [id, entry] of Object.entries(docs)) {
    const docRef = ref.doc(id);
    writes.push([docRef, decode(entry.data)]);
    for (const [sub, subDocs] of Object.entries(entry)) {
      if (sub !== 'data') collectWrites(docRef.collection(sub), subDocs, writes);
    }
  }
}

async function main() {
  const file = process.argv[2];
  if (!file) { console.error('Usage: npm run restore -- <backup.json>'); process.exit(1); }
  const backup = JSON.parse(readFileSync(file, 'utf8'));
  console.log(`Restoring ${file} (made ${backup.createdAt}) into ${projectId} ...`);
  for (const name of Object.keys(backup.collections)) await db.recursiveDelete(db.collection(name));
  const writes = [];
  for (const [name, docs] of Object.entries(backup.collections)) collectWrites(db.collection(name), docs, writes);
  for (let i = 0; i < writes.length; i += 400) {
    const batch = db.batch();
    for (const [ref, data] of writes.slice(i, i + 400)) batch.set(ref, data);
    await batch.commit();
  }
  for (const [name, docs] of Object.entries(backup.collections)) console.log(`${name.padEnd(11)} ${Object.keys(docs).length} documents`);
  console.log(`\nRestored ${writes.length} documents.`);
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
