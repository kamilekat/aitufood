import { useEffect, useRef, useState } from 'react';
import { collection, onSnapshot, orderBy, query, where } from 'firebase/firestore';
import { db } from '../firebase.js';
import { placeOrder, openSlots, formatTenge, MAX_LINES, MAX_QUANTITY, OrderError, SLOT_TIMES } from '../lib/orders.js';
import { orderingDay, slotIsOpen } from '../lib/time.js';
import { CATEGORY_PHOTO_ALT, categoryPhoto } from '../lib/media.js';
import Icon, { CATEGORY_ICON } from '../components/Icon.jsx';

export default function Menu({ session, onOrdered }) {
  const [categories, setCategories] = useState([]);
  const [items, setItems] = useState([]);
  const [slots, setSlots] = useState([]);
  const [cart, setCart] = useState({});
  const [slotId, setSlotId] = useState(null);
  const [message, setMessage] = useState(null);
  const [busy, setBusy] = useState(false);
  // re-check the clock every 30 s: slots that start in less than 10 minutes disappear,
  // and after the last slot of the day the menu switches to tomorrow
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 30000); return () => clearInterval(t); }, []);
  const day = orderingDay();
  const ensured = useRef(new Set());
  const [loadedDay, setLoadedDay] = useState(null);

  // READ operations (R2, R4). onSnapshot keeps them live: a dish marked sold out
  // or a slot that becomes full updates on every phone without a refresh.
  useEffect(() => onSnapshot(query(collection(db, 'categories'), orderBy('sortOrder')),
    (s) => setCategories(s.docs.map((d) => ({ id: d.id, ...d.data() })))), []);
  useEffect(() => onSnapshot(query(collection(db, 'menuItems'), where('available', '==', true)),
    (s) => setItems(s.docs.map((d) => ({ id: d.id, ...d.data() })))), []);
  useEffect(() => onSnapshot(query(collection(db, 'timeSlots'), where('date', '==', day.date)), (s) => {
    setSlots(s.docs.map((d) => ({ id: d.id, ...d.data() })).sort((a, b) => a.startTime.localeCompare(b.startTime)));
    if (!s.metadata.fromCache) setLoadedDay(day.date);
    // R4: slots are created for every day automatically (09:00-17:50); the first visitor of the day creates them
    if (!s.metadata.fromCache && s.size < SLOT_TIMES.length && !ensured.current.has(day.date)) {
      ensured.current.add(day.date);
      openSlots(db, session.uid, day.date, s.docs.map((d) => d.id)).catch(() => {}); // someone else was faster: fine
    }
  }), [day.date, session.uid]);

  // A dish that was sold out while it sat in the cart is removed from the cart
  useEffect(() => {
    const onSale = new Set(items.map((i) => i.id));
    setCart((c) => Object.fromEntries(Object.entries(c).filter(([id]) => onSale.has(id))));
  }, [items]);

  const byId = Object.fromEntries(items.map((i) => [i.id, i]));
  const lines = Object.entries(cart).filter(([id, q]) => q > 0 && byId[id]);
  const count = lines.reduce((s, [, q]) => s + q, 0);
  const total = lines.reduce((s, [id, q]) => s + byId[id].price * q, 0);
  // past slots and slots starting in less than 10 minutes are not shown (the rules reject them too)
  const openList = slots.filter((s) => slotIsOpen(s, now));
  const chosenSlot = openList.find((s) => s.id === slotId);

  // scroll to the pickup slots and move keyboard / screen-reader focus to their heading
  function goToPickup() {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    document.getElementById('pickup')?.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
    document.getElementById('pickup-heading')?.focus({ preventScroll: true });
  }

  function change(id, delta) {
    const q = Math.max(0, Math.min(MAX_QUANTITY, (cart[id] || 0) + delta));
    const next = { ...cart, [id]: q };
    if (q === 0) delete next[id];
    if (Object.keys(next).length > MAX_LINES) {
      setMessage({ type: 'error', text: `Up to ${MAX_LINES} different dishes per order.` });
      return;
    }
    setMessage(null);
    setCart(next);
  }

  async function submit() {
    setBusy(true);
    setMessage(null);
    try {
      // seconds since the page was opened (navigation start), saved for the usability test (B1)
      const seconds = Math.max(1, Math.round(performance.now() / 1000));
      const result = await placeOrder(db, session.uid, slotId, Object.fromEntries(lines), seconds <= 3600 ? seconds : undefined);
      setCart({});
      setSlotId(null);
      setMessage({ type: 'ok', text: `Order #${result.orderNo} placed for ${chosenSlot.startTime}. Total ${formatTenge(result.total)}, pay at pickup. You can cancel it within 30 seconds in My orders. (${seconds} s since you opened the app)` });
      setTimeout(onOrdered, 2000);
    } catch (err) {
      setMessage({ type: 'error', text: err instanceof OrderError ? err.message : 'Could not place the order. Please try again.' });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="pb-36">
      {categories.map((cat, index) => {
        const list = items.filter((i) => i.categoryId === cat.id).sort((a, b) => a.name.localeCompare(b.name));
        if (list.length === 0) return null;
        const photo = categoryPhoto(cat.id);
        return (
          <section key={cat.id} className="mb-5">
            <div className="relative h-28 sm:h-36 rounded-xl overflow-hidden mb-2 bg-slate-200">
              {/* only the first banner is on screen at start; the others load when the user scrolls to them */}
              <picture>
                <source type="image/webp" srcSet={photo.srcSet} sizes={photo.sizes} />
                <img src={photo.fallback} alt={CATEGORY_PHOTO_ALT[cat.id] || ''} width="800" height="267"
                  loading={index === 0 ? 'eager' : 'lazy'} fetchpriority={index === 0 ? 'high' : 'auto'} decoding="async"
                  className="absolute inset-0 w-full h-full object-cover" />
              </picture>
              {/* dark gradient keeps the white heading readable on any photo (contrast at least 4.5:1) */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/50 to-transparent" />
              <h2 className="absolute left-3 bottom-2 text-xl font-bold text-white">{cat.name}</h2>
            </div>
            <ul className="grid gap-2 sm:grid-cols-2">
              {list.map((item) => (
                <li key={item.id} className="bg-white rounded-xl shadow-sm p-3 flex items-center gap-3">
                  <div className="w-14 h-14 shrink-0 rounded-lg bg-blue-50 text-blue-700 flex items-center justify-center">
                    <Icon name={CATEGORY_ICON[item.categoryId]} className="w-8 h-8" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold leading-snug">{item.name}</p>
                    <p className="text-sm text-slate-600 leading-snug">{item.description}</p>
                    <p className="font-semibold text-blue-800">{formatTenge(item.price)}</p>
                  </div>
                  <div className="flex items-center gap-1">
                    {cart[item.id] > 0 && (
                      <>
                        <button onClick={() => change(item.id, -1)} aria-label={`Remove one ${item.name}`}
                          className="w-11 h-11 rounded-lg border border-slate-400 text-xl font-bold">−</button>
                        <span className="w-6 text-center font-semibold" aria-live="polite">{cart[item.id]}</span>
                      </>
                    )}
                    <button onClick={() => change(item.id, 1)} aria-label={`Add ${item.name}`}
                      className="w-11 h-11 rounded-lg bg-blue-700 text-white text-xl font-bold">+</button>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        );
      })}

      <section id="pickup" className="mb-4 scroll-mt-4">
        <h2 id="pickup-heading" tabIndex={-1} className="text-lg font-bold focus:outline-none">Pickup time · {day.label}</h2>
        <p className="text-sm text-slate-600 mb-2">
          Slots every 10 minutes from 09:00 to 18:00; each takes up to 10 orders. Slots that start in less than 10 minutes are not shown.
        </p>
        {openList.length === 0 && (
          <p className="p-3 rounded-lg bg-amber-50 border border-amber-300">
            {loadedDay !== day.date ? 'Loading pickup times…' : slots.length === 0 ? 'Pickup times for this day are not open yet. Please try again in a minute.' : 'No more pickup times for this day.'}
          </p>
        )}
        <div className="flex flex-wrap gap-2">
          {openList.map((s) => {
            const left = s.capacity - s.bookedCount;
            const disabled = left <= 0;
            return (
              <button key={s.id} disabled={disabled} onClick={() => setSlotId(s.id)} aria-pressed={slotId === s.id}
                className={`min-h-12 min-w-24 px-3 rounded-lg border text-left leading-tight
                  ${slotId === s.id ? 'bg-blue-700 text-white border-blue-700' : 'bg-white border-slate-400'}
                  disabled:bg-slate-200 disabled:text-slate-500 disabled:border-slate-300`}>
                <span className="block font-semibold">{s.startTime}</span>
                <span className="block text-xs">{left <= 0 ? 'Full' : `${left} left`}</span>
              </button>
            );
          })}
        </div>
      </section>

      {message && (
        <p role={message.type === 'error' ? 'alert' : 'status'}
          className={`p-3 rounded-lg font-medium ${message.type === 'ok' ? 'bg-green-100 text-green-900' : 'bg-red-100 text-red-900'}`}>
          {message.text}
        </p>
      )}

      <div className="fixed bottom-0 inset-x-0 bg-white border-t border-slate-300 shadow-lg">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center gap-3">
          <div className="flex-1">
            <p className="font-semibold">{count} item{count === 1 ? '' : 's'} · {formatTenge(total)}</p>
            {/* Week 10 (Stage 2 test finding): testers did not see the slots below the menu, so this jumps to them */}
            <button type="button" onClick={goToPickup}
              className="min-h-11 text-sm text-blue-800 font-medium underline text-left">
              {chosenSlot ? `Pickup ${chosenSlot.startTime} · change` : 'Choose a pickup time ↓'}
            </button>
          </div>
          <button onClick={submit} disabled={busy || count === 0 || !slotId}
            className="min-h-12 px-5 rounded-lg bg-blue-700 text-white font-semibold disabled:bg-slate-400">
            {busy ? 'Placing…' : 'Place order'}
          </button>
        </div>
      </div>
    </div>
  );
}
