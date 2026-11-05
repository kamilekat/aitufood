import { useEffect, useState } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../firebase.js';

// Order lines never change after the order is placed, so they are read once and cached
const cache = new Map();

export function useOrderLines(orderId) {
  const [lines, setLines] = useState(cache.get(orderId) || null);
  useEffect(() => {
    if (cache.has(orderId)) return;
    getDocs(collection(db, 'orders', orderId, 'items')).then((s) => {
      const value = s.docs.map((d) => ({ itemId: d.id, ...d.data() }));
      cache.set(orderId, value);
      setLines(value);
    });
  }, [orderId]);
  return lines;
}

export default function OrderLines({ orderId, names }) {
  const lines = useOrderLines(orderId);
  if (!lines) return <p className="text-sm text-slate-500">Loading dishes…</p>;
  return (
    <ul className="text-sm leading-snug">
      {lines.map((l) => (
        <li key={l.itemId}>{l.quantity} × {names[l.itemId] || l.itemId}</li>
      ))}
    </ul>
  );
}
