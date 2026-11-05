// Shared Firebase Admin setup for seed, backup and restore.
// Uses the service-account key of the AituFood project (serviceAccount.json, never committed).
// The Admin SDK bypasses Security Rules, so the key must stay secret.
import { readFileSync, existsSync } from 'node:fs';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';

const keyFile = process.env.GOOGLE_APPLICATION_CREDENTIALS || './serviceAccount.json';
if (!existsSync(keyFile)) {
  console.error(`Service-account key not found: ${keyFile}
Firebase console -> Project settings -> Service accounts -> Generate new private key,
save the file as serviceAccount.json in this folder.`);
  process.exit(1);
}
const key = JSON.parse(readFileSync(keyFile, 'utf8'));
initializeApp({ credential: cert(key), projectId: key.project_id });

export const projectId = key.project_id;
export const db = getFirestore();
export const auth = getAuth();

export const COLLECTIONS = ['users', 'categories', 'menuItems', 'timeSlots', 'counters', 'orders', 'auditLog'];

// Deletes every collection (with subcollections) and every Auth account. Used only for a demo reset.
export async function wipeProject() {
  for (const name of COLLECTIONS) await db.recursiveDelete(db.collection(name));
  let page;
  do {
    page = await auth.listUsers(1000, page?.pageToken);
    if (page.users.length) await auth.deleteUsers(page.users.map((u) => u.uid));
  } while (page.pageToken);
}
