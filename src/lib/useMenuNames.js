import { useEffect, useState } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase.js';

// Dish names for showing order lines (lines store only the dish ID, like a foreign key)
export function useMenuNames() {
  const [names, setNames] = useState({});
  useEffect(() => onSnapshot(collection(db, 'menuItems'),
    (s) => setNames(Object.fromEntries(s.docs.map((d) => [d.id, d.data().name])))), []);
  return names;
}
