// Astana time (UTC+5) helpers, so the app and the seed script agree on "today".
const OFFSET_MS = 5 * 3600 * 1000;

export function astanaDate(offsetDays = 0) {
  const d = new Date(Date.now() + OFFSET_MS);
  d.setUTCDate(d.getUTCDate() + offsetDays);
  return d.toISOString().slice(0, 10);
}

export function astanaNowHHMM() {
  return new Date(Date.now() + OFFSET_MS).toISOString().slice(11, 16);
}

// "2026-10-14_1240" -> "12:40"
export function slotLabel(slotId) {
  const t = slotId.split('_')[1] || '';
  return `${t.slice(0, 2)}:${t.slice(2)}`;
}

export function slotDate(slotId) {
  return slotId.split('_')[0];
}

// Students can order for a slot that starts at least 10 minutes from now (the rules check the same).
// After the last slot of the day (17:50), ordering moves to tomorrow.
export function orderingDay(lastSlot = '17:50') {
  const now = new Date(Date.now() + OFFSET_MS + 10 * 60000).toISOString().slice(11, 16);
  return now <= lastSlot ? { date: astanaDate(0), label: 'Today' } : { date: astanaDate(1), label: 'Tomorrow' };
}

export function slotIsOpen(slot, now = Date.now()) {
  const today = new Date(now + OFFSET_MS).toISOString().slice(0, 10);
  if (slot.date !== today) return slot.date > today;
  const soon = new Date(now + OFFSET_MS + 10 * 60000).toISOString().slice(11, 16);
  return slot.startTime >= soon;
}
