// Resets the AituFood project to realistic demo data (Firestore + Firebase Auth).
//   npm run seed:reset      (deletes ALL data and accounts in the project first)
// Dates are relative to today, so the dashboard always has "today's" orders.
import { Timestamp } from 'firebase-admin/firestore';
import { db, auth, projectId, wipeProject } from './admin.mjs';

// ---------- deterministic random (same data on every run) ----------
let state = 20261014;
function rand() {
  state = (state * 1664525 + 1013904223) % 4294967296;
  return state / 4294967296;
}
const pick = (arr) => arr[Math.floor(rand() * arr.length)];
const between = (min, max) => min + Math.floor(rand() * (max - min + 1));

// ---------- reference data ----------
const categories = [
  { id: 'soups', name: 'Soups', sortOrder: 1 },
  { id: 'mains', name: 'Main dishes', sortOrder: 2 },
  { id: 'salads', name: 'Salads', sortOrder: 3 },
  { id: 'pastries', name: 'Pastries', sortOrder: 4 },
  { id: 'drinks', name: 'Drinks', sortOrder: 5 },
  { id: 'desserts', name: 'Desserts', sortOrder: 6 },
  { id: 'breakfast', name: 'Breakfast', sortOrder: 7 },
  { id: 'sides', name: 'Side dishes', sortOrder: 8 },
  { id: 'grill', name: 'Grill', sortOrder: 9 },
  { id: 'fastfood', name: 'Fast food', sortOrder: 10 },
];

// [id, name, categoryId, price in tenge, description, available]
const menu = [
  ['lagman-soup', 'Lagman soup', 'soups', 1800, 'Hand-pulled noodles, beef and vegetables in broth', true],
  ['borscht', 'Borscht', 'soups', 1500, 'Beetroot soup with beef and sour cream', true],
  ['chicken-noodle', 'Chicken noodle soup', 'soups', 1300, 'Light chicken broth with home-made noodles', true],
  ['lentil-soup', 'Lentil soup', 'soups', 1200, 'Red lentils, carrot and cumin', true],
  ['shorpa', 'Shorpa', 'soups', 1900, 'Lamb and potato soup', true],
  ['plov', 'Plov', 'mains', 2200, 'Rice with beef, carrot and chickpeas', true],
  ['manty', 'Manty (5 pcs)', 'mains', 2000, 'Steamed dumplings with beef and onion', true],
  ['beshbarmak', 'Beshbarmak', 'mains', 2800, 'Boiled beef with flat noodles and onion sauce', false],
  ['chicken-cutlet', 'Chicken cutlet with mashed potatoes', 'mains', 1900, 'Two cutlets, mashed potatoes, gravy', true],
  ['beef-stroganoff', 'Beef stroganoff with buckwheat', 'mains', 2300, 'Beef in creamy sauce, buckwheat side', true],
  ['fried-lagman', 'Fried lagman', 'mains', 2400, 'Wok-fried noodles with beef and peppers', true],
  ['shawarma', 'Chicken shawarma', 'mains', 1800, 'Chicken, vegetables and garlic sauce in lavash', true],
  ['olivier', 'Olivier salad', 'salads', 900, 'Potato, egg, pickles, peas, mayonnaise', true],
  ['vinaigrette', 'Vinaigrette', 'salads', 700, 'Beetroot, potato, pickles, sunflower oil', true],
  ['caesar', 'Caesar with chicken', 'salads', 1600, 'Romaine, chicken, croutons, parmesan', true],
  ['achichuk', 'Achichuk', 'salads', 800, 'Tomato and onion salad', true],
  ['greek', 'Greek salad', 'salads', 1300, 'Cucumber, tomato, feta, olives', true],
  ['samsa', 'Samsa with beef', 'pastries', 600, 'Baked puff pastry with beef and onion', true],
  ['belyash', 'Belyash', 'pastries', 400, 'Fried bun with minced beef', true],
  ['baursaks', 'Baursaks (5 pcs)', 'pastries', 500, 'Fried dough, served warm', true],
  ['cheburek', 'Cheburek', 'pastries', 700, 'Fried pastry with beef', true],
  ['pirozhok', 'Pirozhok with potatoes', 'pastries', 350, 'Baked bun with mashed potato', true],
  ['tea-milk', 'Black tea with milk', 'drinks', 300, '300 ml', true],
  ['americano', 'Americano', 'drinks', 700, '250 ml', true],
  ['cappuccino', 'Cappuccino', 'drinks', 950, '300 ml', true],
  ['kompot', 'Kompot', 'drinks', 400, 'Home-made dried fruit drink, 300 ml', true],
  ['ayran', 'Ayran', 'drinks', 450, '250 ml', true],
  ['chak-chak', 'Chak-chak', 'desserts', 600, 'Fried dough with honey', true],
  ['medovik', 'Medovik', 'desserts', 900, 'Honey layer cake', false],
  ['syrniki', 'Syrniki with sour cream', 'desserts', 1000, 'Three cottage-cheese pancakes', true],
  ['porridge', 'Rice porridge with butter', 'breakfast', 600, 'Milk rice porridge', true],
  ['omelette', 'Omelette with toast', 'breakfast', 900, 'Two eggs, milk, toast', true],
  ['rice', 'Steamed rice', 'sides', 400, '150 g', true],
  ['mash', 'Mashed potatoes', 'sides', 450, '150 g', true],
  ['buckwheat', 'Buckwheat', 'sides', 400, '150 g', true],
  ['shashlik', 'Chicken shashlik', 'grill', 2500, 'Grilled chicken skewer with onion and lavash', true],
  ['kebab', 'Beef lula kebab', 'grill', 2700, 'Minced beef skewer with sauce', false],
  ['hot-dog', 'Hot dog', 'fastfood', 700, 'Sausage in a bun with sauces', true],
  ['burger', 'Beef burger', 'fastfood', 1600, 'Beef patty, cheese, vegetables', true],
  ['fries', 'French fries', 'fastfood', 600, '120 g', true],
];

const studentNames = [
  'Aruzhan Bekova', 'Dias Nurlanov', 'Aigerim Sadykova', 'Nurlan Zhaksybekov', 'Madina Omarova',
  'Alikhan Seitkali', 'Dana Abenova', 'Yerlan Tulegenov', 'Kamila Ospanova', 'Arman Kassymov',
  'Zhanel Mukhamedzhan', 'Sultan Ermekov', 'Aisulu Kenzhebayeva', 'Temirlan Baimukhanov', 'Asel Zhumabayeva',
  'Daniyar Akhmetov', 'Togzhan Sarsenbayeva', 'Bekzat Iskakov', 'Inkar Duisenova', 'Askar Myrzakhmetov',
  'Ayana Smagulova', 'Miras Yessenov', 'Alina Kim', 'Nursultan Abdrakhmanov', 'Saule Ibraeva',
  'Ruslan Tokhtarov', 'Meruyert Kaliyeva', 'Ilyas Bekmurzayev', 'Diana Pak', 'Yerassyl Amanzhol',
  'Aida Rakhimova', 'Olzhas Sabitov', 'Laura Tursynbekova', 'Adil Zhunusov', 'Moldir Baizhanova',
  'Beibarys Kenesov', 'Assem Tleubayeva', 'Nurdaulet Serikbay', 'Gulnaz Shaimerdenova',
];

// Demo accounts used at the defense
const DEMO_STUDENT = { uid: 'stu-240001', email: '240001@astanait.edu.kz', password: 'Aitu2026!', fullName: 'Demo Student' };
const STAFF = [
  { uid: 'staff-cafe', email: 'cafe@astanait.edu.kz', password: 'Cafe2026!', fullName: 'Cafe Manager' },
  { uid: 'staff-cook1', email: 'cook1.cafe@astanait.edu.kz', password: 'Cook2026!', fullName: 'Gulmira Abenova' },
  { uid: 'staff-cook2', email: 'cook2.cafe@astanait.edu.kz', password: 'Cook2026!', fullName: 'Serik Omarov' },
];

// ---------- time helpers (Astana time, UTC+5) ----------
const TZ_OFFSET_MIN = 5 * 60;
function astanaDate(offsetDays) {
  const now = new Date(Date.now() + TZ_OFFSET_MIN * 60000);
  now.setUTCDate(now.getUTCDate() + offsetDays);
  return now.toISOString().slice(0, 10);
}
function at(date, hhmm, plusMinutes = 0) {
  const [h, m] = hhmm.split(':').map(Number);
  const utc = Date.UTC(+date.slice(0, 4), +date.slice(5, 7) - 1, +date.slice(8, 10), h, m) - TZ_OFFSET_MIN * 60000;
  return Timestamp.fromMillis(utc + plusMinutes * 60000);
}
// Pickup slots every 10 minutes 09:00-17:50 (same as src/lib/orders.js); demo orders go into the lunch slots
const ALL_TIMES = [];
for (let h = 9; h <= 17; h++) for (let m = 0; m < 60; m += 10) ALL_TIMES.push(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
const SLOT_TIMES = ALL_TIMES.filter((t) => t >= '12:00' && t <= '13:50');
// Lunch peak 12:40-13:10 gets the most orders
const SLOT_WEIGHTS = [2, 3, 4, 6, 9, 10, 10, 9, 6, 4, 3, 2];

function weightedSlotTime() {
  const total = SLOT_WEIGHTS.reduce((a, b) => a + b, 0);
  let r = rand() * total;
  for (let i = 0; i < SLOT_TIMES.length; i++) {
    r -= SLOT_WEIGHTS[i];
    if (r < 0) return SLOT_TIMES[i];
  }
  return SLOT_TIMES.at(-1);
}

async function commitAll(writes) {
  for (let i = 0; i < writes.length; i += 400) {
    const batch = db.batch();
    for (const [ref, data] of writes.slice(i, i + 400)) batch.set(ref, data);
    await batch.commit();
  }
}

async function main() {
  if (!process.argv.includes('--reset')) {
    console.error(`This deletes ALL data and accounts in ${projectId} and loads demo data. Run: npm run seed:reset`);
    process.exit(1);
  }
  console.log(`Resetting ${projectId} ...`);
  await wipeProject();

  const writes = [];
  const log = (userId, action, targetId, time) =>
    writes.push([db.collection('auditLog').doc(), { userId, action, targetId, at: time }]);
  const registeredAt = at(astanaDate(-30), '10:00');

  // users + Firebase Auth accounts (passwords are hashed by Firebase Auth, never stored in Firestore)
  const students = [DEMO_STUDENT];
  studentNames.forEach((fullName, i) => {
    const id = 240002 + i * 7;
    students.push({ uid: `stu-${id}`, email: `${id}@astanait.edu.kz`, password: `Student-${id}!`, fullName });
  });
  for (const u of students) {
    await auth.createUser({ uid: u.uid, email: u.email, password: u.password, displayName: u.fullName });
    writes.push([db.doc(`users/${u.uid}`), { fullName: u.fullName, email: u.email, role: 'student', consentAt: registeredAt, createdAt: registeredAt }]);
    log(u.uid, 'register', u.uid, registeredAt);
  }
  for (const s of STAFF) {
    await auth.createUser({ uid: s.uid, email: s.email, password: s.password, displayName: s.fullName });
    await auth.setCustomUserClaims(s.uid, { role: 'staff' }); // role can only be granted here, by the admin
    writes.push([db.doc(`users/${s.uid}`), { fullName: s.fullName, email: s.email, role: 'staff', consentAt: registeredAt, createdAt: registeredAt }]);
  }

  // categories and menu
  for (const c of categories) writes.push([db.doc(`categories/${c.id}`), { name: c.name, sortOrder: c.sortOrder }]);
  const menuById = {};
  for (const [id, name, categoryId, price, description, available] of menu) {
    menuById[id] = { name, price, available };
    writes.push([db.doc(`menuItems/${id}`), {
      name, categoryId, price, description, available, photoUrl: null, updatedAt: registeredAt,
    }]);
  }
  log('staff-cafe', 'menu_updated', 'beshbarmak', at(astanaDate(0), '11:30'));
  log('staff-cafe', 'menu_updated', 'medovik', at(astanaDate(0), '11:32'));

  // time slots: 3 days back, today, tomorrow; 54 slots of 10 minutes per day
  const days = [-3, -2, -1, 0, 1].map(astanaDate);
  const today = astanaDate(0);
  const booked = {};
  for (const d of days) for (const t of ALL_TIMES) booked[`${d}_${t.replace(':', '')}`] = 0;

  // orders
  const plan = [];
  const ordersPerDay = { [days[0]]: 34, [days[1]]: 36, [days[2]]: 33, [today]: 24, [days[4]]: 6 };
  for (const d of days) {
    for (let i = 0; i < ordersPerDay[d]; i++) {
      let t = weightedSlotTime();
      let slotId = `${d}_${t.replace(':', '')}`;
      while (booked[slotId] >= 10) { t = pick(SLOT_TIMES); slotId = `${d}_${t.replace(':', '')}`; }
      booked[slotId]++;
      plan.push({ date: d, time: t, slotId });
    }
  }
  // Make the 13:00 slot today full so the "Full" chip is visible in the demo (R4)
  const fullSlot = `${today}_1300`;
  while (booked[fullSlot] < 10) { booked[fullSlot]++; plan.push({ date: today, time: '13:00', slotId: fullSlot }); }

  for (const p of plan) p.createdAt = at(p.date, p.time, -between(15, 150));
  plan.sort((a, b) => a.createdAt.toMillis() - b.createdAt.toMillis());

  const available = menu.filter((m) => m[5]).map((m) => m[0]);
  const nowMs = Date.now();
  let orderNo = 1001;
  for (const p of plan) {
    const user = pick(students);
    const lines = {};
    const nLines = between(1, 3) + (rand() < 0.3 ? 1 : 0);
    while (Object.keys(lines).length < nLines) lines[pick(available)] = rand() < 0.15 ? 2 : 1;
    const total = Object.entries(lines).reduce((s, [id, q]) => s + menuById[id].price * q, 0);

    // Status depends on how far the pickup time is from now
    const pickupMs = at(p.date, p.time).toMillis();
    let status;
    const roll = rand();       // drawn every time so the generated data does not depend on the clock
    const openStatus = pick(['new', 'cooking', 'ready']);
    if (p.date < today) status = roll < 0.04 ? 'cancelled' : 'picked_up';
    else if (p.date > today) status = 'new';
    else if (pickupMs < nowMs - 20 * 60000) status = 'picked_up';
    else if (pickupMs < nowMs) status = 'ready';
    else if (pickupMs < nowMs + 30 * 60000) status = 'cooking';
    else status = 'new';
    // Keep the live demo interesting: some of today's orders are always open
    if (p.date === today && status === 'picked_up' && roll < 0.35) status = openStatus;

    const ref = db.collection('orders').doc();
    const delay = between(10, 40);
    const updatedAt = status === 'new' ? p.createdAt : Timestamp.fromMillis(p.createdAt.toMillis() + delay * 60000);
    writes.push([ref, { orderNo, userId: user.uid, slotId: p.slotId, status, total, createdAt: p.createdAt, updatedAt }]);
    for (const [itemId, quantity] of Object.entries(lines)) {
      writes.push([ref.collection('items').doc(itemId), { quantity, priceAtOrder: menuById[itemId].price }]);
    }
    log(user.uid, 'order_created', ref.id, p.createdAt);
    if (p.date === today && status !== 'new') log('staff-cook1', 'status_changed', ref.id, updatedAt);
    orderNo++;
  }

  for (const d of days) for (const t of ALL_TIMES) {
    const id = `${d}_${t.replace(':', '')}`;
    writes.push([db.doc(`timeSlots/${id}`), { date: d, startTime: t, capacity: 10, bookedCount: booked[id] }]);
  }
  writes.push([db.doc('counters/orders'), { next: orderNo }]);

  await commitAll(writes);

  const lineCount = writes.filter(([ref]) => ref.path.includes('/items/')).length;
  console.log(`users:      ${students.length + STAFF.length}  (${students.length} students, ${STAFF.length} staff)`);
  console.log(`categories: ${categories.length}`);
  console.log(`menuItems:  ${menu.length}`);
  console.log(`timeSlots:  ${days.length * ALL_TIMES.length}`);
  console.log(`orders:     ${plan.length}`);
  console.log(`items:      ${lineCount}  (order lines)`);
  console.log(`auditLog:   ${writes.filter(([ref]) => ref.path.startsWith('auditLog/')).length}`);
  console.log('\nDemo logins:');
  console.log(`  student  ${DEMO_STUDENT.email} / ${DEMO_STUDENT.password}`);
  console.log(`  staff    ${STAFF[0].email} / ${STAFF[0].password}`);
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
