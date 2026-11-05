import { useState } from 'react';
import {
  createUserWithEmailAndPassword, signInWithEmailAndPassword, updateProfile,
} from 'firebase/auth';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../firebase.js';
import { writeLog } from '../lib/orders.js';

const AITU_EMAIL = /^[^\s@]+@astanait\.edu\.kz$/i;

// Firebase Auth error codes -> messages a student understands
const MESSAGES = {
  'auth/invalid-credential': 'Wrong e-mail or password.',
  'auth/email-already-in-use': 'This e-mail is already registered. Sign in instead.',
  'auth/weak-password': 'The password must be at least 8 characters.',
  'auth/too-many-requests': 'Too many attempts. Wait a minute and try again.',
};

// mode: 'login' or 'register' (chosen with the header buttons or the home page)
export default function Login({ mode, onModeChange }) {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [consent, setConsent] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setError('');
    // R1: only AITU addresses. The Security Rules repeat this check on the server.
    if (!AITU_EMAIL.test(email.trim())) { setError('Use your AITU e-mail (…@astanait.edu.kz).'); return; }
    if (mode === 'register' && password.length < 8) { setError(MESSAGES['auth/weak-password']); return; }
    if (mode === 'register' && fullName.trim().length < 2) { setError('Enter your name.'); return; }
    if (mode === 'register' && !consent) { setError('Please agree to the processing of your personal data.'); return; }

    setBusy(true);
    try {
      if (mode === 'register') {
        // Firebase Auth hashes the password (scrypt); it is never stored in Firestore
        const { user } = await createUserWithEmailAndPassword(auth, email.trim(), password);
        await updateProfile(user, { displayName: fullName.trim() });
        await setDoc(doc(db, 'users', user.uid), {
          fullName: fullName.trim(), email: user.email, role: 'student',
          consentAt: serverTimestamp(), createdAt: serverTimestamp(),
        });
        await writeLog(db, user.uid, 'register', user.uid);
      } else {
        const { user } = await signInWithEmailAndPassword(auth, email.trim(), password);
        await writeLog(db, user.uid, 'login', user.uid);
      }
    } catch (err) {
      setError(MESSAGES[err.code] || 'Something went wrong. Please try again.');
      setBusy(false);
    }
  }

  const input = 'w-full min-h-12 px-3 rounded-lg border border-slate-400 bg-white focus:outline-none focus:ring-2 focus:ring-blue-600';
  return (
    <div className="flex justify-center">
      <form onSubmit={submit} className="w-full max-w-sm bg-white rounded-2xl shadow p-6 space-y-4" noValidate>
        <div>
          <h2 className="text-2xl font-bold text-blue-800">{mode === 'register' ? 'Create an account' : 'Sign in'}</h2>
          <p className="text-slate-600">Pre-order lunch at the AITU café and skip the queue.</p>
        </div>
        {mode === 'register' && (
          <label className="block">
            <span className="font-medium">Full name</span>
            <input className={input} value={fullName} onChange={(e) => setFullName(e.target.value)} autoComplete="name" />
          </label>
        )}
        <label className="block">
          <span className="font-medium">AITU e-mail</span>
          <input className={input} type="email" value={email} onChange={(e) => setEmail(e.target.value)}
            placeholder="240001@astanait.edu.kz" autoComplete="email" />
        </label>
        <label className="block">
          <span className="font-medium">Password</span>
          <input className={input} type="password" value={password} onChange={(e) => setPassword(e.target.value)}
            autoComplete={mode === 'register' ? 'new-password' : 'current-password'} />
        </label>
        {mode === 'register' && (
          <label className="flex items-start gap-3 text-sm">
            <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-1 w-5 h-5 shrink-0" />
            <span>
              I agree that AituFood stores my name and AITU e-mail to handle my lunch orders
              (Law of RK No. 94-V). Orders are kept 12 months; I can ask to delete my account.
            </span>
          </label>
        )}
        {error && <p role="alert" className="text-red-700 font-medium">{error}</p>}
        <button disabled={busy} className="w-full min-h-12 rounded-lg bg-blue-700 text-white font-semibold disabled:opacity-60">
          {busy ? 'Please wait…' : mode === 'register' ? 'Create account' : 'Sign in'}
        </button>
        <button type="button" onClick={() => onModeChange(mode === 'login' ? 'register' : 'login')}
          className="w-full min-h-11 text-blue-800 font-medium underline">
          {mode === 'login' ? 'New here? Create an account' : 'I already have an account'}
        </button>
      </form>
    </div>
  );
}
