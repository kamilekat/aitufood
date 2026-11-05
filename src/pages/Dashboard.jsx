import { useEffect, useRef, useState } from 'react';
import { collection, doc, getDoc, getDocs, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '../firebase.js';
import OrderLines from '../components/OrderLines.jsx';
import { NEXT_STATUS, SLOT_TIMES, formatTenge, openSlots, setOrderStatus } from '../lib/orders.js';
import { astanaDate, orderingDay, slotLabel } from '../lib/time.js';
import { useMenuNames } from '../lib/useMenuNames.js';
import Icon from '../components/Icon.jsx';

const COLUMNS = [
  ['new', 'New', 'border-sky-500'],
  ['cooking', 'Cooking', 'border-amber-500'],
  ['ready', 'Ready', 'border-green-600'],
];
const ACTION = { new: 'Start cooking', cooking: 'Mark ready', ready: 'Picked up' };

const nameCache = new Map();
function useCustomerName(uid) {
  const [name, setName] = useState(nameCache.get(uid));
  useEffect(() => {
    if (nameCache.has(uid)) return;
    getDoc(doc(db, 'users', uid)).then((s) => {
      const value = s.exists() ? s.data().fullName : 'Unknown';
      nameCache.set(uid, value);
      setName(value);
    });
  }, [uid]);
  return name || '…';
}

function OrderCard({ order, names, session, fresh }) {
  const customer = useCustomerName(order.userId);
  const [busy, setBusy] = useState(false);
  async function advance() {
    setBusy(true);
    try { await setOrderStatus(db, session.uid, order.id, NEXT_STATUS[order.status]); } finally { setBusy(false); }
  }
  return (
    <li className={`bg-white rounded-xl shadow-sm p-3 ${fresh ? 'ring-2 ring-sky-500 animate-new-order' : ''}`}>
      <div className="flex items-baseline justify-between">
        <span className="text-2xl font-bold">#{order.orderNo}</span>
        <span className="font-semibold text-slate-700">{slotLabel(order.slotId)}</span>
      </div>
      <p className="font-medium">{customer}</p>
      <OrderLines orderId={order.id} names={names} />
      <div className="mt-2 flex items-center justify-between gap-2">
        <span className="text-sm text-slate-600">{formatTenge(order.total)} · pay at pickup</span>
        <button onClick={advance} disabled={busy}
          className="min-h-11 px-3 rounded-lg bg-blue-700 text-white font-semibold disabled:opacity-60">
          {ACTION[order.status]}
        </button>
      </div>
    </li>
  );
}

export default function Dashboard({ session }) {
  // Same day the students are ordering for: today until the last slot, then tomorrow
  const [date, setDate] = useState(orderingDay().date);
  const [slots, setSlots] = useState([]);
  const [orders, setOrders] = useState([]);
  const [fresh, setFresh] = useState(new Set());
  const [opening, setOpening] = useState(false);
  const [notice, setNotice] = useState('');
  const [showReport, setShowReport] = useState(false);
  // Sound is OFF until staff switch it on: nothing plays automatically, and the click also
  // satisfies the browser rule that audio may only start after a user gesture.
  const [soundOn, setSoundOn] = useState(false);
  const chime = useRef(null);
  const soundOnRef = useRef(false);
  const known = useRef(null);
  const names = useMenuNames();

  function toggleSound() {
    if (!chime.current) chime.current = new Audio('/sounds/new-order.mp3');
    soundOnRef.current = !soundOn;
    setSoundOn(!soundOn);
  }

  useEffect(() => onSnapshot(query(collection(db, 'timeSlots'), where('date', '==', date)), (s) => {
    setSlots(s.docs.map((d) => ({ id: d.id, ...d.data() })));
    // today and tomorrow get their 54 slots automatically (other days: button below)
    if (!s.metadata.fromCache && s.size < SLOT_TIMES.length && [astanaDate(0), astanaDate(1)].includes(date)) {
      openSlots(db, session.uid, date, s.docs.map((d) => d.id)).catch(() => {});
    }
  }), [date, session.uid]);

  // READ operation (R8): every order for the chosen day, pushed live by Firestore.
  // Slot IDs start with the date ("2026-11-02_1240"), so one range query finds the whole day.
  // New orders appear without refreshing the page and are highlighted for a few seconds.
  useEffect(() => {
    known.current = null;
    return onSnapshot(query(collection(db, 'orders'), where('slotId', '>=', `${date}_`), where('slotId', '<=', `${date}_9999`)), (s) => {
      const list = s.docs.map((d) => ({ id: d.id, ...d.data() }));
      if (known.current) {
        // a student cancelled within 30 s: tell the kitchen not to cook it (text, not colour only)
        const cancelled = list.filter((o) => o.status === 'cancelled' && known.current.get(o.id) === 'new');
        if (cancelled.length) {
          setNotice(`Order ${cancelled.map((o) => `#${o.orderNo}`).join(', ')} was cancelled by the student`);
          setTimeout(() => setNotice(''), 8000);
        }
        const addedOrders = list.filter((o) => !known.current.has(o.id));
        const added = addedOrders.map((o) => o.id);
        if (added.length) {
          setFresh((f) => new Set([...f, ...added]));
          setTimeout(() => setFresh((f) => new Set([...f].filter((id) => !added.includes(id)))), 8000);
          // the sound is never the only signal: the same event is shown as text and a highlighted card
          setNotice(`New order ${addedOrders.map((o) => `#${o.orderNo}`).join(', ')} received`);
          setTimeout(() => setNotice(''), 8000);
          if (soundOnRef.current && chime.current) {
            chime.current.currentTime = 0;
            chime.current.play().catch(() => {});
          }
        }
      }
      known.current = new Map(list.map((o) => [o.id, o.status]));
      setOrders(list);
    });
  }, [date]);

  const active = orders.filter((o) => o.status !== 'cancelled');
  const done = active.filter((o) => o.status === 'picked_up');
  const revenue = done.reduce((s, o) => s + o.total, 0);
  const perSlot = {};
  for (const o of active) perSlot[o.slotId] = (perSlot[o.slotId] || 0) + 1;
  const busiest = Object.entries(perSlot).sort((a, b) => b[1] - a[1])[0];

  return (
    <div>
      <div className="flex flex-wrap items-end gap-3 mb-4">
        <label className="block">
          <span className="text-sm font-medium">Day</span>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)}
            className="block min-h-11 px-3 rounded-lg border border-slate-400 bg-white" />
        </label>
        <dl className="flex flex-wrap gap-2 text-sm">
          <Stat label="Orders" value={active.length} />
          <Stat label="Picked up" value={done.length} />
          <Stat label="Revenue" value={formatTenge(revenue)} />
          <Stat label="Busiest slot" value={busiest ? `${slotLabel(busiest[0])} (${busiest[1]})` : '—'} />
        </dl>
        <button onClick={() => setShowReport(!showReport)} aria-expanded={showReport} aria-controls="daily-report"
          className="min-h-11 px-3 rounded-lg border border-slate-400 bg-white font-semibold">
          {showReport ? 'Hide daily report' : 'Daily report'}
        </button>
        <button onClick={toggleSound} aria-pressed={soundOn}
          className={`min-h-11 px-3 rounded-lg border font-semibold flex items-center gap-2 ${soundOn ? 'bg-blue-700 text-white border-blue-700' : 'bg-white text-slate-800 border-slate-400'}`}>
          <Icon name={soundOn ? 'bell' : 'bell-off'} className="w-5 h-5" />
          {soundOn ? 'Sound on' : 'Sound off'}
        </button>
      </div>

      <p role="status" aria-live="polite"
        className={notice ? 'mb-4 p-3 rounded-xl bg-sky-100 border border-sky-400 text-sky-900 font-semibold flex items-center gap-2' : 'sr-only'}>
        {notice && <Icon name="bell" className="w-5 h-5 shrink-0" />}
        {notice}
      </p>

      {showReport && <DailyReport date={date} orders={active} names={names} />}

      {slots.length === 0 && (
        <div className="mb-4 p-4 rounded-xl bg-amber-50 border border-amber-300 flex flex-wrap items-center gap-3">
          <p className="flex-1 font-medium">No pickup slots are open for {date}. Students cannot order for this day yet.</p>
          <button disabled={opening} onClick={async () => { setOpening(true); try { await openSlots(db, session.uid, date); } finally { setOpening(false); } }}
            className="min-h-11 px-4 rounded-lg bg-blue-700 text-white font-semibold disabled:opacity-60">
            Open slots (09:00–17:50)
          </button>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-3">
        {COLUMNS.map(([status, title, border]) => {
          const list = orders.filter((o) => o.status === status)
            .sort((a, b) => a.slotId.localeCompare(b.slotId) || a.orderNo - b.orderNo);
          return (
            <section key={status} className={`bg-slate-100 rounded-xl p-3 border-t-4 ${border}`}>
              <h2 className="text-lg font-bold mb-2">{title} <span className="text-slate-600">({list.length})</span></h2>
              <ul className="space-y-2">
                {list.map((o) => <OrderCard key={o.id} order={o} names={names} session={session} fresh={fresh.has(o.id)} />)}
                {list.length === 0 && <li className="text-slate-500 text-sm">No orders</li>}
              </ul>
            </section>
          );
        })}
      </div>
    </div>
  );
}

// R10 (Stage 2, C5): the daily report for the café, the same questions as in the data analysis:
// which pickup slots are busiest and which dishes sell most. Cancelled orders are not counted.
function DailyReport({ date, orders, names }) {
  const [dishes, setDishes] = useState(null);
  const ids = orders.map((o) => o.id).sort().join(',');
  useEffect(() => {
    let stop = false;
    setDishes(null);
    // READ: the order lines of every order of the day (orders/{id}/items)
    Promise.all(ids ? ids.split(',').map((id) => getDocs(collection(db, 'orders', id, 'items'))) : []).then((snaps) => {
      const qty = {};
      for (const snap of snaps) for (const d of snap.docs) qty[d.id] = (qty[d.id] || 0) + d.data().quantity;
      if (!stop) setDishes(Object.entries(qty).sort((a, b) => b[1] - a[1]).slice(0, 5));
    });
    return () => { stop = true; };
  }, [ids]);

  // a day has 54 slots, so only the slots with orders are listed
  const perSlot = {};
  for (const o of orders) perSlot[o.slotId] = (perSlot[o.slotId] || 0) + 1;
  const slotRows = Object.entries(perSlot).sort((a, b) => a[0].localeCompare(b[0]));
  const max = Math.max(1, ...slotRows.map(([, n]) => n));
  const revenue = orders.reduce((s, o) => s + o.total, 0);

  return (
    <section id="daily-report" aria-labelledby="daily-report-title" className="mb-4 p-4 rounded-xl bg-white shadow-sm">
      <h2 id="daily-report-title" className="text-lg font-bold">Daily report · {date}</h2>
      <p className="text-sm text-slate-600 mb-3">
        {orders.length} orders (without cancelled) · {formatTenge(revenue)} ordered · average {orders.length ? formatTenge(Math.round(revenue / orders.length)) : '—'} per order
      </p>
      <div className="grid gap-6 md:grid-cols-2">
        <div>
          <h3 className="font-semibold mb-2">Orders per pickup slot (slots with orders)</h3>
          {slotRows.length === 0 && <p className="text-sm text-slate-500">No orders for this day.</p>}
          <ul className="space-y-1">
            {slotRows.map(([id, n]) => (
              <li key={id} className="flex items-center gap-2 text-sm">
                <span className="w-12 tabular-nums">{slotLabel(id)}</span>
                <span className="flex-1 h-4 bg-slate-100 rounded" aria-hidden="true">
                  <span className="block h-4 rounded bg-blue-700" style={{ width: `${(n / max) * 100}%` }} />
                </span>
                <span className="w-6 text-right tabular-nums font-semibold">{n}</span>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h3 className="font-semibold mb-2">Top 5 dishes (portions)</h3>
          {!dishes && <p className="text-sm text-slate-500">Loading…</p>}
          {dishes && dishes.length === 0 && <p className="text-sm text-slate-500">No orders yet.</p>}
          {dishes && dishes.length > 0 && (
            <table className="w-full text-sm">
              <thead><tr className="text-left text-slate-600"><th className="font-medium py-1">Dish</th><th className="font-medium py-1 text-right">Portions</th></tr></thead>
              <tbody>
                {dishes.map(([id, q]) => (
                  <tr key={id} className="border-t border-slate-200">
                    <td className="py-1">{names[id] || id}</td>
                    <td className="py-1 text-right tabular-nums font-semibold">{q}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </section>
  );
}

function Stat({ label, value }) {
  return (
    <div className="bg-white rounded-lg px-3 py-2 shadow-sm">
      <dt className="text-slate-600">{label}</dt>
      <dd className="font-bold">{value}</dd>
    </div>
  );
}
