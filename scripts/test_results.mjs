// Stage 2, B1: reads the usability-test orders back from Firestore (READ ONLY).
// Every order placed from the app stores secondsToOrder = seconds from opening the app to "Place order".
//   npm run test:results -- 2026-11-03            (orders created on that day, Astana time)
//   npm run test:results -- 2026-11-03 2026-11-04 (a range of days)
// Testers are shown as T1, T2, ... in order of their first order; names are printed only on your screen
// so you can match them to the observation sheet. Do not copy names into the report.
import { Timestamp } from 'firebase-admin/firestore';
import { db } from './admin.mjs';

const from = process.argv[2];
const to = process.argv[3] || from;
if (!from) {
  console.error('usage: npm run test:results -- <YYYY-MM-DD> [YYYY-MM-DD]');
  process.exit(1);
}
const start = Timestamp.fromMillis(Date.parse(`${from}T00:00:00+05:00`));
const end = Timestamp.fromMillis(Date.parse(`${to}T23:59:59+05:00`));

const snap = await db.collection('orders').where('createdAt', '>=', start).where('createdAt', '<=', end).orderBy('createdAt').get();
const rows = snap.docs.map((d) => d.data()).filter((o) => Number.isInteger(o.secondsToOrder));
const names = new Map();
for (const o of rows) {
  if (names.has(o.userId)) continue;
  const u = await db.doc(`users/${o.userId}`).get();
  names.set(o.userId, { code: `T${names.size + 1}`, name: u.exists ? u.data().fullName : '?' });
}

console.log('tester  name                      order   placed (Astana)   seconds  under 60 s');
for (const o of rows) {
  const t = names.get(o.userId);
  const at = new Date(o.createdAt.toMillis() + 5 * 3600000).toISOString().slice(0, 16).replace('T', ' ');
  console.log(`${t.code.padEnd(7)} ${t.name.slice(0, 25).padEnd(25)} #${String(o.orderNo).padEnd(6)} ${at}  ${String(o.secondsToOrder).padStart(7)}  ${o.secondsToOrder < 60 ? 'yes' : 'NO'}`);
}
// first order of each tester = the measured task
const first = [...names.keys()].map((uid) => rows.find((o) => o.userId === uid).secondsToOrder);
if (first.length) {
  const mean = first.reduce((a, b) => a + b, 0) / first.length;
  console.log(`\nFirst order per tester: ${first.length} testers, ${first.filter((s) => s < 60).length} under 60 s, mean ${mean.toFixed(1)} s, min ${Math.min(...first)} s, max ${Math.max(...first)} s`);
} else {
  console.log('No orders with secondsToOrder in this period.');
}
process.exit(0);
