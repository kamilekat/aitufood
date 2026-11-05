// Order logic shared by the app and the rules tests.
import {
  collection, doc, runTransaction, serverTimestamp, updateDoc, addDoc, writeBatch, increment,
} from 'firebase/firestore';

export const MAX_LINES = 5;      // keeps one order inside the Security Rules read limit
export const MAX_QUANTITY = 10;  // same CHECK as in firestore.rules
export const STATUSES = ['new', 'cooking', 'ready', 'picked_up', 'cancelled'];
export const NEXT_STATUS = { new: 'cooking', cooking: 'ready', ready: 'picked_up' };
export const CANCEL_SECONDS = 30; // a student may cancel a new order this long after placing it (same limit in firestore.rules)

export class OrderError extends Error {}

/**
 * WRITE operation (R4, R5). Places an order in one transaction:
 * reads the slot, the order counter and current menu prices, then writes the order,
 * its lines, the slot booking, the next order number and an audit-log entry.
 * If two students take the last place at the same moment, Firestore retries
 * one transaction and it fails with "slot full" instead of overbooking.
 * cart: { menuItemId: quantity }
 * secondsToOrder (optional, Stage 2 B1): seconds from opening the app to "Place order",
 * stored with the order so the 60-second success criterion is measured from the database.
 */
export async function placeOrder(db, uid, slotId, cart, secondsToOrder) {
  const ids = Object.keys(cart).filter((id) => cart[id] > 0);
  if (ids.length === 0) throw new OrderError('Your cart is empty.');
  if (ids.length > MAX_LINES) throw new OrderError(`An order can contain at most ${MAX_LINES} different dishes.`);
  for (const id of ids) {
    const q = cart[id];
    if (!Number.isInteger(q) || q < 1 || q > MAX_QUANTITY) throw new OrderError(`Quantity must be 1-${MAX_QUANTITY}.`);
  }

  return runTransaction(db, async (tx) => {
    const slotRef = doc(db, 'timeSlots', slotId);
    const counterRef = doc(db, 'counters', 'orders');
    const itemRefs = ids.map((id) => doc(db, 'menuItems', id));

    const slotSnap = await tx.get(slotRef);
    const counterSnap = await tx.get(counterRef);
    const itemSnaps = [];
    for (const ref of itemRefs) itemSnaps.push(await tx.get(ref));

    if (!slotSnap.exists()) throw new OrderError('This pickup slot does not exist.');
    const slot = slotSnap.data();
    if (slot.bookedCount >= slot.capacity) throw new OrderError('This pickup slot is already full. Please choose another one.');

    // The price always comes from the database, never from the browser
    let total = 0;
    const lines = [];
    itemSnaps.forEach((snap, i) => {
      if (!snap.exists() || !snap.data().available) {
        throw new OrderError(`${snap.exists() ? snap.data().name : ids[i]} is sold out.`);
      }
      const price = snap.data().price;
      total += price * cart[ids[i]];
      lines.push([ids[i], { quantity: cart[ids[i]], priceAtOrder: price }]);
    });

    const orderNo = counterSnap.data().next;
    const orderRef = doc(collection(db, 'orders'));
    tx.set(orderRef, {
      orderNo, userId: uid, slotId, status: 'new', total,
      createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
      ...(Number.isInteger(secondsToOrder) && secondsToOrder >= 1 && secondsToOrder <= 3600 ? { secondsToOrder } : {}),
    });
    for (const [itemId, line] of lines) tx.set(doc(orderRef, 'items', itemId), line);
    tx.update(slotRef, { bookedCount: slot.bookedCount + 1 });
    tx.update(counterRef, { next: orderNo + 1 });
    tx.set(doc(collection(db, 'auditLog')), {
      userId: uid, action: 'order_created', targetId: orderRef.id, at: serverTimestamp(),
    });
    return { orderId: orderRef.id, orderNo, total };
  });
}

/**
 * WRITE operation for the student: cancel a "new" order within 30 seconds of placing it.
 * One batch: the order becomes "cancelled", its place in the slot is given back and the
 * cancellation is logged. The rules check the 30 seconds with the server clock, so changing
 * the clock on the phone does not help.
 */
export async function cancelOrder(db, uid, order) {
  const batch = writeBatch(db);
  batch.update(doc(db, 'orders', order.id), { status: 'cancelled', updatedAt: serverTimestamp() });
  batch.update(doc(db, 'timeSlots', order.slotId), { bookedCount: increment(-1), releasedBy: order.id });
  batch.set(doc(collection(db, 'auditLog')), { userId: uid, action: 'order_cancelled', targetId: order.id, at: serverTimestamp() });
  await batch.commit();
}

/** WRITE operation for cafe staff (R6, R8): move an order to the next status. */
export async function setOrderStatus(db, staffUid, orderId, status) {
  if (!STATUSES.includes(status)) throw new OrderError('Unknown status.');
  await updateDoc(doc(db, 'orders', orderId), { status, updatedAt: serverTimestamp() });
  await writeLog(db, staffUid, 'status_changed', orderId);
}

/** WRITE operation for cafe staff (R9): mark a dish sold out or back on sale. */
export async function setAvailable(db, staffUid, itemId, available) {
  await updateDoc(doc(db, 'menuItems', itemId), { available, updatedAt: serverTimestamp() });
  await writeLog(db, staffUid, 'menu_updated', itemId);
}

// Pickup slots: every 10 minutes from 09:00 to 17:50 (the last one ends at 18:00), 54 per day
export const SLOT_TIMES = [];
for (let h = 9; h <= 17; h++) for (let m = 0; m < 60; m += 10) SLOT_TIMES.push(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
export const slotIdOf = (date, startTime) => `${date}_${startTime.replace(':', '')}`;

/**
 * WRITE operation (R4): creates the missing pickup slots of one day (capacity 10, empty).
 * The free Spark plan has no scheduled Cloud Functions, so the app does it itself: the first
 * student or staff member who opens the menu or dashboard for today/tomorrow creates the day.
 * The rules allow a student only empty slots of exactly this shape; staff can open any day.
 * existingIds: slot IDs of that day that already exist (they are never overwritten).
 */
export async function openSlots(db, uid, date, existingIds = [], capacity = 10) {
  const have = new Set(existingIds);
  const missing = SLOT_TIMES.filter((t) => !have.has(slotIdOf(date, t)));
  if (missing.length === 0) return 0;
  const batch = writeBatch(db);
  for (const startTime of missing) {
    batch.set(doc(db, 'timeSlots', slotIdOf(date, startTime)), { date, startTime, capacity, bookedCount: 0 });
  }
  await batch.commit();
  await writeLog(db, uid, 'slots_opened', date);
  return missing.length;
}

export function writeLog(db, uid, action, targetId) {
  return addDoc(collection(db, 'auditLog'), { userId: uid, action, targetId, at: serverTimestamp() });
}

export function formatTenge(n) {
  return `${n.toLocaleString('ru-RU')} ₸`;
}
