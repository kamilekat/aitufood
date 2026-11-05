import { useEffect, useState } from 'react';
import { addDoc, collection, doc, onSnapshot, orderBy, query, serverTimestamp, updateDoc } from 'firebase/firestore';
import { db } from '../firebase.js';
import { formatTenge, setAvailable, writeLog } from '../lib/orders.js';

const EMPTY_DISH = { name: '', categoryId: '', price: '', description: '' };

// R9: café staff add dishes, mark them sold out (they disappear from the student menu at once) and edit prices
export default function MenuEditor({ session }) {
  const [items, setItems] = useState([]);
  const [categories, setCategories] = useState([]);
  const [prices, setPrices] = useState({});
  const [dish, setDish] = useState(EMPTY_DISH);
  const [error, setError] = useState('');
  const [added, setAdded] = useState('');

  useEffect(() => onSnapshot(query(collection(db, 'categories'), orderBy('sortOrder')),
    (s) => setCategories(s.docs.map((d) => ({ id: d.id, ...d.data() })))), []);

  useEffect(() => onSnapshot(collection(db, 'menuItems'),
    (s) => setItems(s.docs.map((d) => ({ id: d.id, ...d.data() }))
      .sort((a, b) => a.categoryId.localeCompare(b.categoryId) || a.name.localeCompare(b.name)))), []);

  async function savePrice(item) {
    setError('');
    const price = Number(prices[item.id]);
    if (!Number.isInteger(price) || price < 100 || price > 10000) {
      setError('Price must be a whole number from 100 to 10 000 tenge.');
      return;
    }
    await updateDoc(doc(db, 'menuItems', item.id), { price, updatedAt: serverTimestamp() });
    await writeLog(db, session.uid, 'menu_updated', item.id);
    setPrices((p) => { const n = { ...p }; delete n[item.id]; return n; });
  }

  // WRITE operation (R9): a new dish; the rules check the category (foreign key) and the price range
  async function addDish(e) {
    e.preventDefault();
    setError('');
    setAdded('');
    const price = Number(dish.price);
    if (dish.name.trim().length < 2) { setError('Enter the dish name (at least 2 characters).'); return; }
    if (!dish.categoryId) { setError('Choose a category.'); return; }
    if (!Number.isInteger(price) || price < 100 || price > 10000) {
      setError('Price must be a whole number from 100 to 10 000 tenge.');
      return;
    }
    const ref = await addDoc(collection(db, 'menuItems'), {
      name: dish.name.trim(), categoryId: dish.categoryId, price,
      description: dish.description.trim().slice(0, 200), available: true, updatedAt: serverTimestamp(),
    });
    await writeLog(db, session.uid, 'menu_updated', ref.id);
    setAdded(`${dish.name.trim()} was added to the menu.`);
    setDish(EMPTY_DISH);
  }

  const field = 'block w-full min-h-11 px-3 rounded-lg border border-slate-400 bg-white';
  return (
    <div>
      <form onSubmit={addDish} className="mb-4 p-4 rounded-xl bg-white shadow-sm grid gap-3 sm:grid-cols-2" noValidate>
        <h2 className="sm:col-span-2 text-lg font-bold">Add a dish</h2>
        <label className="block">
          <span className="text-sm font-medium">Name</span>
          <input value={dish.name} onChange={(e) => setDish({ ...dish, name: e.target.value })} maxLength={60} className={field} />
        </label>
        <label className="block">
          <span className="text-sm font-medium">Category</span>
          <select value={dish.categoryId} onChange={(e) => setDish({ ...dish, categoryId: e.target.value })} className={field}>
            <option value="">Choose…</option>
            {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </label>
        <label className="block">
          <span className="text-sm font-medium">Price, ₸</span>
          <input inputMode="numeric" value={dish.price} onChange={(e) => setDish({ ...dish, price: e.target.value })} className={field} />
        </label>
        <label className="block">
          <span className="text-sm font-medium">Description (optional)</span>
          <input value={dish.description} onChange={(e) => setDish({ ...dish, description: e.target.value })} maxLength={200} className={field} />
        </label>
        <div className="sm:col-span-2 flex flex-wrap items-center gap-3">
          <button type="submit" className="min-h-11 px-4 rounded-lg bg-blue-700 text-white font-semibold">Add dish</button>
          {added && <p role="status" className="text-green-800 font-medium">{added}</p>}
        </div>
      </form>
      {error && <p role="alert" className="mb-3 p-3 rounded-lg bg-red-100 text-red-900 font-medium">{error}</p>}
      <ul className="grid gap-2 sm:grid-cols-2">
        {items.map((item) => (
          <li key={item.id} className="bg-white rounded-xl shadow-sm p-3">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="font-semibold">{item.name}</p>
                <p className="text-sm text-slate-600">{item.categoryId} · {formatTenge(item.price)}</p>
              </div>
              <button onClick={() => setAvailable(db, session.uid, item.id, !item.available)}
                aria-pressed={!item.available}
                className={`min-h-11 px-3 rounded-lg font-semibold border ${item.available
                  ? 'bg-green-100 text-green-900 border-green-400' : 'bg-red-100 text-red-900 border-red-300'}`}>
                {item.available ? 'On sale' : 'Sold out'}
              </button>
            </div>
            <div className="mt-2 flex gap-2">
              <label className="sr-only" htmlFor={`price-${item.id}`}>New price for {item.name}</label>
              <input id={`price-${item.id}`} inputMode="numeric" placeholder="New price, ₸"
                value={prices[item.id] ?? ''} onChange={(e) => setPrices({ ...prices, [item.id]: e.target.value })}
                className="flex-1 min-h-11 px-3 rounded-lg border border-slate-400" />
              <button onClick={() => savePrice(item)} disabled={!prices[item.id]}
                className="min-h-11 px-3 rounded-lg bg-blue-700 text-white font-semibold disabled:bg-slate-300">Save</button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
