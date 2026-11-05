import { useEffect, useState } from 'react';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from './firebase.js';
import Login from './pages/Login.jsx';
import Home from './pages/Home.jsx';
import Menu from './pages/Menu.jsx';
import MyOrders from './pages/MyOrders.jsx';
import Dashboard from './pages/Dashboard.jsx';
import MenuEditor from './pages/MenuEditor.jsx';

const STUDENT_TABS = [['menu', 'Menu'], ['orders', 'My orders']];
const STAFF_TABS = [['dashboard', 'Orders'], ['editor', 'Menu editor']];

// Visitors: home page, or the sign-in / register form. The choice is kept in the URL hash
// (#signin, #register), so the browser Back button returns to the home page.
const AUTH_HASH = { '#signin': 'login', '#register': 'register' };
function useAuthView() {
  const [view, setView] = useState(AUTH_HASH[window.location.hash] || null);
  useEffect(() => {
    const onHash = () => setView(AUTH_HASH[window.location.hash] || null);
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);
  const go = (mode) => { window.location.hash = mode === 'register' ? 'register' : mode === 'login' ? 'signin' : ''; };
  return [view, go];
}

function Brand({ subtitle, compact = false }) {
  return (
    <div className="flex items-center gap-3">
      {/* decorative: the name is already in the heading next to it */}
      <img src="/logo.svg" alt="" width="40" height="40" className="w-10 h-10 shrink-0" />
      <div>
        <h1 className="text-xl font-bold leading-tight">AituFood</h1>
        <p className={`text-sm text-blue-100 ${compact ? 'hidden sm:block' : ''}`}>{subtitle}</p>
      </div>
    </div>
  );
}

export default function App() {
  const [session, setSession] = useState(undefined); // undefined = loading, null = signed out
  const [tab, setTab] = useState(null);
  const [authView, goAuth] = useAuthView();

  useEffect(() => onAuthStateChanged(auth, async (user) => {
    if (!user) { setSession(null); return; }
    // The role comes from a custom claim that only the admin can set, not from the browser
    const token = await user.getIdTokenResult();
    const role = token.claims.role === 'staff' ? 'staff' : 'student';
    const profile = await getDoc(doc(db, 'users', user.uid)).catch(() => null);
    const fullName = profile?.exists() ? profile.data().fullName : user.displayName || user.email;
    setSession({ uid: user.uid, email: user.email, role, fullName });
    setTab(role === 'staff' ? 'dashboard' : 'menu');
    if (window.location.hash) window.history.replaceState(null, '', window.location.pathname);
  }), []);

  if (session === undefined) return <p className="p-6 text-slate-600">Loading…</p>;
  if (session === null) {
    return (
      <div className="min-h-screen">
        <header className="bg-blue-700 text-white">
          <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
            <button onClick={() => goAuth(null)} className="text-left rounded-lg" aria-label="AituFood home page">
              <Brand subtitle="Lunch pre-order for AITU" compact />
            </button>
            <nav className="flex gap-2" aria-label="Account">
              <button onClick={() => goAuth('login')} aria-current={authView === 'login' ? 'page' : undefined}
                className="min-h-11 px-3 rounded-lg border border-blue-300 text-sm font-semibold whitespace-nowrap hover:bg-blue-800">
                Sign in
              </button>
              <button onClick={() => goAuth('register')} aria-current={authView === 'register' ? 'page' : undefined}
                className="min-h-11 px-3 rounded-lg bg-white text-blue-800 text-sm font-semibold whitespace-nowrap">
                Register
              </button>
            </nav>
          </div>
        </header>
        <main className="max-w-5xl mx-auto px-4 py-6">
          {authView ? <Login key={authView} mode={authView} onModeChange={goAuth} /> : <Home onAuth={goAuth} />}
        </main>
      </div>
    );
  }

  const tabs = session.role === 'staff' ? STAFF_TABS : STUDENT_TABS;
  return (
    <div className="min-h-screen">
      <header className="bg-blue-700 text-white">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
          <Brand subtitle={`${session.fullName} · ${session.role === 'staff' ? 'Café staff' : 'Student'}`} />
          <button onClick={() => signOut(auth)}
            className="min-h-11 px-4 rounded-lg border border-blue-300 text-sm font-medium hover:bg-blue-800">
            Sign out
          </button>
        </div>
        <nav className="max-w-5xl mx-auto px-2 flex gap-1" aria-label="Main">
          {tabs.map(([id, label]) => (
            <button key={id} onClick={() => setTab(id)} aria-current={tab === id ? 'page' : undefined}
              className={`min-h-12 px-4 font-semibold rounded-t-lg ${tab === id ? 'bg-slate-50 text-blue-800' : 'text-blue-100 hover:bg-blue-800'}`}>
              {label}
            </button>
          ))}
        </nav>
      </header>
      <main className="max-w-5xl mx-auto px-4 py-4">
        {tab === 'menu' && <Menu session={session} onOrdered={() => setTab('orders')} />}
        {tab === 'orders' && <MyOrders session={session} />}
        {tab === 'dashboard' && <Dashboard session={session} />}
        {tab === 'editor' && <MenuEditor session={session} />}
      </main>
    </div>
  );
}
