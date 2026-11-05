import { useEffect, useState } from 'react';
import { collection, limit, onSnapshot, orderBy, query, where } from 'firebase/firestore';
import { db } from '../firebase.js';
import StatusBadge from '../components/StatusBadge.jsx';
import OrderLines from '../components/OrderLines.jsx';
import { CANCEL_SECONDS, cancelOrder, formatTenge } from '../lib/orders.js';
import { slotLabel, slotDate, astanaDate } from '../lib/time.js';
import { useMenuNames } from '../lib/useMenuNames.js';

const STEPS = ['new', 'cooking', 'ready', 'picked_up'];

// Seconds left to cancel a new order; the server (firestore.rules) makes the final decision
function useSecondsLeft(order) {
  const created = order.createdAt?.toMillis?.();
  const calc = () => (order.status === 'new' && created ? Math.ceil((created + CANCEL_SECONDS * 1000 - Date.now()) / 1000) : 0);
  const [left, setLeft] = useState(calc);
  useEffect(() => {
    setLeft(calc());
    const timer = setInterval(() => { const l = calc(); setLeft(l); if (l <= 0) clearInterval(timer); }, 1000);
    return () => clearInterval(timer);
  }, [created, order.status]); // eslint-disable-line react-hooks/exhaustive-deps
  return left;
}

function CancelButton({ order, session }) {
  const left = useSecondsLeft(order);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  if (left <= 0 && !error) return null;
  async function cancel() {
    setBusy(true);
    setError('');
    try { await cancelOrder(db, session.uid, order); } catch { setError('Too late to cancel: the café has already got this order.'); } finally { setBusy(false); }
  }
  return (
    <div className="mt-3">
      {left > 0 && (
        <button onClick={cancel} disabled={busy}
          className="min-h-11 px-4 rounded-lg border border-red-400 text-red-800 bg-white font-semibold disabled:opacity-60">
          {busy ? 'Cancelling…' : `Cancel order (${left} s)`}
        </button>
      )}
      {error && <p role="alert" className="mt-2 text-red-800 font-medium">{error}</p>}
    </div>
  );
}

export default function MyOrders({ session }) {
  const [orders, setOrders] = useState(null);
  const names = useMenuNames();

  // READ operation (R6): the student's own orders, updated live when the café changes the status.
  // The query must filter by userId, otherwise the Security Rules reject it.
  useEffect(() => onSnapshot(
    query(collection(db, 'orders'), where('userId', '==', session.uid), orderBy('createdAt', 'desc'), limit(10)),
    (s) => setOrders(s.docs.map((d) => ({ id: d.id, ...d.data() }))),
  ), [session.uid]);

  if (!orders) return <p>Loading…</p>;
  if (orders.length === 0) return <p className="text-slate-600">You have no orders yet.</p>;

  const today = astanaDate(0);
  return (
    <ul className="space-y-3">
      {orders.map((o) => {
        const day = slotDate(o.slotId);
        const step = STEPS.indexOf(o.status);
        return (
          <li key={o.id} className={`bg-white rounded-xl shadow-sm p-4 ${o.status === 'ready' ? 'ring-2 ring-green-500' : ''}`}>
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-2xl font-bold">#{o.orderNo}</p>
                <p className="text-slate-600">
                  Pickup {slotLabel(o.slotId)} {day === today ? 'today' : day}
                </p>
              </div>
              <StatusBadge status={o.status} />
            </div>
            {o.status === 'ready' && (
              <p role="status" className="mt-2 p-2 rounded-lg bg-green-100 text-green-900 font-semibold">
                Your order #{o.orderNo} is ready. Pick it up at the café counter.
              </p>
            )}
            <CancelButton order={o} session={session} />
            {step >= 0 && (
              <ol className="mt-3 grid grid-cols-4 gap-1" aria-label="Order progress">
                {STEPS.map((s, i) => (
                  <li key={s} className={`h-2 rounded ${i <= step ? 'bg-blue-700' : 'bg-slate-200'}`} />
                ))}
              </ol>
            )}
            <div className="mt-3 flex items-end justify-between gap-2">
              <OrderLines orderId={o.id} names={names} />
              <p className="font-semibold whitespace-nowrap">{formatTenge(o.total)}</p>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
