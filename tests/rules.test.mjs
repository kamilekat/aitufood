// Security Rules tests: prove that the rules enforce roles and data constraints.
// Run:  npm run test:rules   (starts a temporary Firestore emulator)
// or, with the emulators already running:  node --test tests/
import { test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  initializeTestEnvironment, assertSucceeds, assertFails,
} from '@firebase/rules-unit-testing';
import {
  doc, getDoc, setDoc, updateDoc, deleteDoc, collection, getDocs, query, where, serverTimestamp, Timestamp,
} from 'firebase/firestore';
import { placeOrder, openSlots, cancelOrder } from '../src/lib/orders.js';

let env;
// slots in the tests are tomorrow (Astana time), so they are always in the future
const TOMORROW = new Date(Date.now() + 5 * 3600000 + 86400000).toISOString().slice(0, 10);
const STUDENT = { uid: 'stu-1', email: '240001@astanait.edu.kz' };
const OTHER = { uid: 'stu-2', email: '240002@astanait.edu.kz' };
const STAFF = { uid: 'staff-1', email: 'cafe@astanait.edu.kz', role: 'staff' };

const as = (u) => env.authenticatedContext(u.uid, { email: u.email, ...(u.role ? { role: u.role } : {}) }).firestore();

before(async () => {
  const [host, port] = (process.env.FIRESTORE_EMULATOR_HOST || '127.0.0.1:8080').split(':');
  env = await initializeTestEnvironment({
    projectId: 'demo-aitufood-tests',
    firestore: { rules: readFileSync('firestore.rules', 'utf8'), host, port: Number(port) },
  });
});
after(() => env.cleanup());

beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    const t = Timestamp.now();
    await setDoc(doc(db, 'categories/mains'), { name: 'Main dishes', sortOrder: 1 });
    await setDoc(doc(db, 'menuItems/plov'), { name: 'Plov', categoryId: 'mains', price: 2200, available: true, updatedAt: t });
    await setDoc(doc(db, 'menuItems/manty'), { name: 'Manty', categoryId: 'mains', price: 2000, available: true, updatedAt: t });
    for (const [id, price] of [['samsa', 600], ['ayran', 450], ['caesar', 1600]]) {
      await setDoc(doc(db, `menuItems/${id}`), { name: id, categoryId: 'mains', price, available: true, updatedAt: t });
    }
    await setDoc(doc(db, 'menuItems/beshbarmak'), { name: 'Beshbarmak', categoryId: 'mains', price: 2800, available: false, updatedAt: t });
    await setDoc(doc(db, 'timeSlots/s1240'), { date: TOMORROW, startTime: '12:40', capacity: 10, bookedCount: 3 });
    await setDoc(doc(db, 'timeSlots/s1300'), { date: TOMORROW, startTime: '13:00', capacity: 10, bookedCount: 10 });
    await setDoc(doc(db, 'counters/orders'), { next: 1001 });
    await setDoc(doc(db, `users/${STUDENT.uid}`), { fullName: 'Demo Student', email: STUDENT.email, role: 'student', consentAt: t, createdAt: t });
    await setDoc(doc(db, 'orders/o-other'), { orderNo: 1000, userId: OTHER.uid, slotId: 's1240', status: 'new', total: 2200, createdAt: t, updatedAt: t });
    await setDoc(doc(db, 'auditLog/l1'), { userId: OTHER.uid, action: 'login', targetId: OTHER.uid, at: t });
  });
});

test('R1/R11: a non-AITU e-mail cannot read the menu', async () => {
  const db = env.authenticatedContext('x', { email: 'someone@gmail.com' }).firestore();
  await assertFails(getDoc(doc(db, 'menuItems/plov')));
});

test('R11: a visitor who is not logged in cannot read anything', async () => {
  await assertFails(getDoc(doc(env.unauthenticatedContext().firestore(), 'menuItems/plov')));
});

test('R2: a logged-in student reads the menu', async () => {
  await assertSucceeds(getDocs(collection(as(STUDENT), 'menuItems')));
});

test('A student cannot register as staff (privilege escalation)', async () => {
  const db = as(OTHER);
  await assertFails(setDoc(doc(db, `users/${OTHER.uid}`), { fullName: 'Hacker', email: OTHER.email, role: 'staff', consentAt: serverTimestamp(), createdAt: serverTimestamp() }));
  await assertSucceeds(setDoc(doc(db, `users/${OTHER.uid}`), { fullName: 'Dias Nurlanov', email: OTHER.email, role: 'student', consentAt: serverTimestamp(), createdAt: serverTimestamp() }));
});

test('R15: a profile without consent to data processing is rejected', async () => {
  const db = as(OTHER);
  await assertFails(setDoc(doc(db, `users/${OTHER.uid}`), { fullName: 'Dias Nurlanov', email: OTHER.email, role: 'student', createdAt: serverTimestamp() }));
});

test('R5: a student places a valid order and gets the next order number', async () => {
  const result = await assertSucceeds(placeOrder(as(STUDENT), STUDENT.uid, 's1240', { plov: 1, manty: 2 }));
  assert.equal(result.orderNo, 1001);
  assert.equal(result.total, 2200 + 2 * 2000);
});

test('R5: the largest allowed order (5 different dishes) fits inside the rules limits', async () => {
  const cart = { plov: 1, manty: 1, samsa: 2, ayran: 3, caesar: 1 };
  const result = await assertSucceeds(placeOrder(as(STUDENT), STUDENT.uid, 's1240', cart));
  assert.equal(result.total, 2200 + 2000 + 1200 + 1350 + 1600);
});

test('R12: the time from opening the app is saved with the order; a fake value is rejected', async () => {
  const result = await assertSucceeds(placeOrder(as(STUDENT), STUDENT.uid, 's1240', { plov: 1 }, 42));
  let saved;
  await env.withSecurityRulesDisabled(async (ctx) => { saved = await getDoc(doc(ctx.firestore(), 'orders', result.orderId)); });
  assert.equal(saved.data().secondsToOrder, 42);
  const db = as(STUDENT);
  const { writeBatch } = await import('firebase/firestore');
  const b = writeBatch(db);
  b.set(doc(collection(db, 'orders')), { orderNo: 1002, userId: STUDENT.uid, slotId: 's1240', status: 'new', total: 2200, secondsToOrder: 'fast', createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
  b.update(doc(db, 'timeSlots/s1240'), { bookedCount: 5 });
  b.update(doc(db, 'counters/orders'), { next: 1003 });
  await assertFails(b.commit());
});

test('Cancel: a student cancels their own new order within 30 s and the slot place is given back', async () => {
  const { orderId } = await placeOrder(as(STUDENT), STUDENT.uid, 's1240', { plov: 1 });
  await assertSucceeds(cancelOrder(as(STUDENT), STUDENT.uid, { id: orderId, slotId: 's1240' }));
  const slot = await getDoc(doc(as(STUDENT), 'timeSlots/s1240'));
  assert.equal(slot.data().bookedCount, 3);
});

test('Cancel: not after 30 s, not for another student, and no free slot places without a cancel', async () => {
  await env.withSecurityRulesDisabled(async (ctx) => {
    const old = Timestamp.fromMillis(Date.now() - 31000);
    await setDoc(doc(ctx.firestore(), 'orders/o-old'), { orderNo: 999, userId: STUDENT.uid, slotId: 's1240', status: 'new', total: 2200, createdAt: old, updatedAt: old });
  });
  await assertFails(cancelOrder(as(STUDENT), STUDENT.uid, { id: 'o-old', slotId: 's1240' }));     // too late
  await assertFails(cancelOrder(as(STUDENT), STUDENT.uid, { id: 'o-other', slotId: 's1240' }));   // not their order
  await assertFails(updateDoc(doc(as(STUDENT), 'timeSlots/s1240'), { bookedCount: 2, releasedBy: 'o-other' }));
});

test('R4: an order into a full slot is rejected', async () => {
  await assert.rejects(placeOrder(as(STUDENT), STUDENT.uid, 's1300', { plov: 1 }), /full/);
});

test('R4: the rules themselves block overbooking, even if the app check is skipped', async () => {
  await assertFails(updateDoc(doc(as(STUDENT), 'timeSlots/s1300'), { bookedCount: 11 }));
});

test('CHECK: a fake price in an order line is rejected by the rules', async () => {
  const db = as(STUDENT);
  const { writeBatch } = await import('firebase/firestore');
  const b = writeBatch(db);
  const orderRef = doc(collection(db, 'orders'));
  b.set(orderRef, { orderNo: 1001, userId: STUDENT.uid, slotId: 's1240', status: 'new', total: 1, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
  b.set(doc(orderRef, 'items', 'plov'), { quantity: 1, priceAtOrder: 1 }); // real price is 2200
  b.update(doc(db, 'timeSlots/s1240'), { bookedCount: 4 });
  b.update(doc(db, 'counters/orders'), { next: 1002 });
  await assertFails(b.commit());
});

test('R9: a sold-out dish cannot be ordered', async () => {
  await assert.rejects(placeOrder(as(STUDENT), STUDENT.uid, 's1240', { beshbarmak: 1 }), /sold out/);
});

test("R11: a student cannot read another student's order", async () => {
  await assertFails(getDoc(doc(as(STUDENT), 'orders/o-other')));
  await assertSucceeds(getDocs(query(collection(as(STUDENT), 'orders'), where('userId', '==', STUDENT.uid))));
});

test('R11: a student cannot change an order status (dashboard is staff only)', async () => {
  await assertFails(updateDoc(doc(as(OTHER), 'orders/o-other'), { status: 'ready', updatedAt: serverTimestamp() }));
});

test('R8: cafe staff read all orders and change the status', async () => {
  const db = as(STAFF);
  await assertSucceeds(getDocs(collection(db, 'orders')));
  await assertSucceeds(updateDoc(doc(db, 'orders/o-other'), { status: 'cooking', updatedAt: serverTimestamp() }));
});

test('R4: a student creates only empty standard slots for today/tomorrow; staff open any day', async () => {
  await assertSucceeds(openSlots(as(STUDENT), STUDENT.uid, TOMORROW, ['ignored']));
  const slot = await getDoc(doc(as(STUDENT), `timeSlots/${TOMORROW}_0900`));
  assert.deepEqual(slot.data(), { date: TOMORROW, startTime: '09:00', capacity: 10, bookedCount: 0 });
  await assert.rejects(openSlots(as(STUDENT), STUDENT.uid, '2026-10-20'));                 // a past day
  await assertFails(setDoc(doc(as(STUDENT), `timeSlots/${TOMORROW}_2000`), { date: TOMORROW, startTime: '20:00', capacity: 10, bookedCount: 0 }));
  await assertFails(setDoc(doc(as(STUDENT), `timeSlots/${TOMORROW}_0910`), { date: TOMORROW, startTime: '09:10', capacity: 30, bookedCount: 0 }));
  await assertSucceeds(openSlots(as(STAFF), STAFF.uid, '2026-10-20'));
});

test('R4: no order for a slot that has already started (checked with the server clock)', async () => {
  await env.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), 'timeSlots/past'), { date: '2026-10-14', startTime: '12:40', capacity: 10, bookedCount: 0 });
  });
  await assertFails(placeOrder(as(STUDENT), STUDENT.uid, 'past', { plov: 1 }));
});

test('CHECK: staff cannot set an unknown status or a negative price', async () => {
  const db = as(STAFF);
  await assertFails(updateDoc(doc(db, 'orders/o-other'), { status: 'eaten', updatedAt: serverTimestamp() }));
  await assertFails(updateDoc(doc(db, 'menuItems/plov'), { price: -5, updatedAt: serverTimestamp() }));
});

test('Audit log: students cannot read it and nobody can edit or delete it', async () => {
  await assertFails(getDoc(doc(as(STUDENT), 'auditLog/l1')));
  await assertSucceeds(getDoc(doc(as(STAFF), 'auditLog/l1')));
  await assertFails(updateDoc(doc(as(STAFF), 'auditLog/l1'), { action: 'register' }));
  await assertFails(deleteDoc(doc(as(STAFF), 'auditLog/l1')));
});
