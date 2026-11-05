// Status is shown with colour AND a text label, so it is readable for colour-blind users
const STYLE = {
  new: ['New', 'bg-sky-100 text-sky-900 border-sky-300'],
  cooking: ['Cooking', 'bg-amber-100 text-amber-900 border-amber-300'],
  ready: ['Ready', 'bg-green-100 text-green-900 border-green-400'],
  picked_up: ['Picked up', 'bg-slate-100 text-slate-700 border-slate-300'],
  cancelled: ['Cancelled', 'bg-red-50 text-red-800 border-red-200'],
};

export default function StatusBadge({ status }) {
  const [label, cls] = STYLE[status] || [status, 'bg-slate-100'];
  return <span className={`inline-block px-2 py-0.5 rounded-full border text-sm font-semibold ${cls}`}>{label}</span>;
}
