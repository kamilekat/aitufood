import Icon from '../components/Icon.jsx';
import { CATEGORY_PHOTO_ALT, categoryPhoto } from '../lib/media.js';

// Public home page (no login needed): what problem AituFood solves and how it works.
// The numbers come from our Stage 1 survey and observation at the AITU café.
const FACTS = [
  ['8–9 min', 'from joining the queue to getting food at the lunch peak (our observation, 09.10.2026)'],
  ['14 of 18', 'students in our survey were late for class or skipped lunch because of the queue'],
  ['14 of 18', 'students said they would use a pre-order app'],
];

const STEPS = [
  ['shopping-cart', 'Choose your dishes', 'See the menu with prices and what is still on sale, and fill your cart.'],
  ['clock', 'Pick a 10-minute slot', 'Each pickup slot takes up to 10 orders, so the kitchen is never overloaded.'],
  ['bell', 'Pick up when it is ready', 'Follow the status New → Cooking → Ready and collect your lunch without queuing.'],
];

export default function Home({ onAuth }) {
  const photo = categoryPhoto('mains');
  return (
    <div className="space-y-8 pb-8">
      <section className="grid gap-6 md:grid-cols-2 md:items-center">
        <div>
          <h2 className="text-3xl sm:text-4xl font-bold leading-tight text-slate-900">Lunch at AITU without the queue</h2>
          <p className="mt-3 text-lg text-slate-700">
            AituFood lets AITU students and staff pre-order lunch from the campus café, choose a pickup time
            and collect the food when it is ready. The café gets clear orders in real time instead of a crowd at the counter.
          </p>
          <div className="mt-5 flex flex-wrap gap-3">
            <button onClick={() => onAuth('register')} className="min-h-12 px-5 rounded-lg bg-blue-700 text-white font-semibold">
              Create an account
            </button>
            <button onClick={() => onAuth('login')} className="min-h-12 px-5 rounded-lg border border-blue-700 text-blue-800 bg-white font-semibold">
              Sign in
            </button>
          </div>
          <p className="mt-3 text-sm text-slate-600">Only AITU e-mail addresses (…@astanait.edu.kz) can register.</p>
        </div>
        <picture>
          <source type="image/webp" srcSet={photo.srcSet} sizes="(min-width: 768px) 480px, calc(100vw - 32px)" />
          <img src={photo.fallback} alt={CATEGORY_PHOTO_ALT.mains} width="800" height="267" fetchpriority="high"
            className="w-full h-44 sm:h-60 object-cover rounded-2xl shadow-sm" />
        </picture>
      </section>

      <section aria-labelledby="problem-title">
        <h2 id="problem-title" className="text-xl font-bold mb-3">The problem</h2>
        <ul className="grid gap-3 sm:grid-cols-3">
          {FACTS.map(([value, text]) => (
            <li key={text} className="bg-white rounded-xl shadow-sm p-4">
              <p className="text-3xl font-bold text-blue-800">{value}</p>
              <p className="text-slate-700">{text}</p>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="how-title">
        <h2 id="how-title" className="text-xl font-bold mb-3">How it works</h2>
        <ol className="grid gap-3 sm:grid-cols-3">
          {STEPS.map(([icon, title, text], i) => (
            <li key={title} className="bg-white rounded-xl shadow-sm p-4">
              <div className="flex items-center gap-3 mb-2">
                <span className="w-10 h-10 rounded-lg bg-blue-50 text-blue-700 flex items-center justify-center">
                  <Icon name={icon} className="w-6 h-6" />
                </span>
                <p className="font-semibold">{i + 1}. {title}</p>
              </div>
              <p className="text-slate-700">{text}</p>
            </li>
          ))}
        </ol>
      </section>

      <section aria-labelledby="cafe-title" className="bg-white rounded-xl shadow-sm p-4 flex gap-4 items-start">
        <span className="w-10 h-10 shrink-0 rounded-lg bg-amber-50 text-amber-800 flex items-center justify-center">
          <Icon name="chart-column" className="w-6 h-6" />
        </span>
        <div>
          <h2 id="cafe-title" className="text-xl font-bold">For the café</h2>
          <p className="text-slate-700">
            A live order dashboard grouped by pickup slot, a menu editor for prices and sold-out dishes,
            and a daily report of the busiest slots and most popular dishes, so the kitchen knows how much to cook.
          </p>
        </div>
      </section>

      <footer className="text-sm text-slate-600 border-t border-slate-200 pt-4">
        <p>AituFood is an ICT 101 student project at Astana IT University (Kamila Tangirbergen, Karlygash Duisenbayeva).</p>
        <p>We store only your name and AITU e-mail to handle orders (Law of RK No. 94-V). Payment is at pickup. Photos: Unsplash.</p>
      </footer>
    </div>
  );
}
