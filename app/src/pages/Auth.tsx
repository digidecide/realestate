import { useEffect, useState, type FormEvent } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';
import { getMyPhone, updateMyProfile } from '../lib/api';
import { ROLE_LABEL } from '../lib/labels';
import { db, PREVIEW } from '../lib/supabase';
import { Notice, RequireRole, useAction } from '../components/ui';

const redirect = (path: string) => `${window.location.origin}/#${path}`;

function PreviewOnly() {
  return <div className="wrap page"><div className="auth-card"><Notice kind="warn">Accounts open once the database is connected. Until then you can browse the sample listings.</Notice></div></div>;
}

export function homeFor(role?: string) {
  return role === 'seller' ? '/seller' : role === 'admin' ? '/admin' : role === 'lawyer' || role === 'surveyor' ? '/reviews' : '/buyer';
}

export function SignIn() {
  const { session, profile } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mode, setMode] = useState<'signin' | 'reset'>('signin');
  const [sent, setSent] = useState(false);
  const a = useAction();
  if (PREVIEW) return <PreviewOnly />;
  if (session && profile) return <Navigate to={homeFor(profile.role)} replace />;

  async function submit(e: FormEvent) {
    e.preventDefault();
    await a.run(async () => {
      if (mode === 'reset') {
        const { error } = await db().auth.resetPasswordForEmail(email.trim(), { redirectTo: redirect('/account?reset=1') });
        if (error) throw error;
        setSent(true);
      } else {
        const { error } = await db().auth.signInWithPassword({ email: email.trim(), password });
        if (error) throw new Error(error.message === 'Invalid login credentials' ? 'That email and password do not match. Check them, or reset your password.' : error.message);
      }
    });
  }

  return (
    <div className="wrap page">
      <form className="panel stack auth-card" onSubmit={submit}>
        <h1 style={{ fontSize: '1.8rem' }}>{mode === 'reset' ? 'Reset your password' : 'Sign in'}</h1>
        {sent ? <Notice kind="ok">We sent a reset link to {email}. Open it on this device to choose a new password.</Notice> : (
          <>
            <label>Email<input type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></label>
            {mode === 'signin' && <label>Password<input type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} /></label>}
            {a.error && <Notice kind="error">{a.error}</Notice>}
            <button className="btn primary" disabled={a.busy}>{a.busy ? 'Please wait…' : mode === 'reset' ? 'Send reset link' : 'Sign in'}</button>
          </>
        )}
        <div className="spread">
          <button type="button" className="linkbtn" onClick={() => { setMode(mode === 'reset' ? 'signin' : 'reset'); setSent(false); a.setError(''); }}>
            {mode === 'reset' ? 'Back to sign in' : 'Forgot your password?'}
          </button>
          <Link to="/signup">Create an account</Link>
        </div>
      </form>
    </div>
  );
}

export function SignUp() {
  const { session, profile } = useAuth();
  const [role, setRole] = useState<'buyer' | 'seller'>('buyer');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [agree, setAgree] = useState(false);
  const [sent, setSent] = useState(false);
  const a = useAction();
  if (PREVIEW) return <PreviewOnly />;
  if (session && profile) return <Navigate to={homeFor(profile.role)} replace />;

  async function submit(e: FormEvent) {
    e.preventDefault();
    await a.run(async () => {
      if (password.length < 8) throw new Error('Use a password of at least 8 characters.');
      const { data, error } = await db().auth.signUp({
        email: email.trim(), password,
        options: { emailRedirectTo: redirect('/account'), data: { full_name: name.trim(), phone: phone.trim(), role } },
      });
      if (error) throw error;
      if (!data.session) setSent(true);
    });
  }

  return (
    <div className="wrap page">
      <form className="panel stack auth-card" onSubmit={submit}>
        <h1 style={{ fontSize: '1.8rem' }}>Create your account</h1>
        {sent ? <Notice kind="ok">Check {email} for a confirmation link. Open it to finish creating your account.</Notice> : (
          <>
            <fieldset>
              <legend>I want to</legend>
              <div className="role-pick">
                <label><input type="radio" name="role" checked={role === 'buyer'} onChange={() => setRole('buyer')} /> Buy land<span>Search, save and contact sellers</span></label>
                <label><input type="radio" name="role" checked={role === 'seller'} onChange={() => setRole('seller')} /> Sell land<span>List property and answer buyers</span></label>
              </div>
            </fieldset>
            <label>Full name<input required autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} /></label>
            <label>Phone or WhatsApp<input required inputMode="tel" autoComplete="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+91" /></label>
            <label>Email<input type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} /></label>
            <label>Password <span className="hint">At least 8 characters</span><input type="password" required autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} /></label>
            <label className="check"><input type="checkbox" required checked={agree} onChange={(e) => setAgree(e.target.checked)} /> I understand verification results are not a guarantee of title.</label>
            {a.error && <Notice kind="error">{a.error}</Notice>}
            <button className="btn primary" disabled={a.busy}>{a.busy ? 'Creating account…' : 'Create account'}</button>
          </>
        )}
        <p className="small">Already have an account? <Link to="/signin">Sign in</Link></p>
      </form>
    </div>
  );
}

export function Account() {
  return <RequireRole><AccountForm /></RequireRole>;
}

function AccountForm() {
  const { session, profile, refresh } = useAuth();
  const nav = useNavigate();
  const reset = new URLSearchParams(window.location.hash.split('?')[1] || '').get('reset') === '1';
  const [name, setName] = useState(profile?.full_name || '');
  const [city, setCity] = useState(profile?.city || '');
  const [phone, setPhone] = useState('');
  const [pw, setPw] = useState('');
  const [saved, setSaved] = useState('');
  const a = useAction();
  const uid = session!.user.id;
  useEffect(() => { getMyPhone(uid).then(setPhone).catch(() => {}); }, [uid]);

  return (
    <div className="wrap page">
      <div className="stack auth-card" style={{ maxWidth: 560 }}>
        <div className="spread">
          <h1 style={{ fontSize: '1.8rem' }}>Your account</h1>
          <span className="pill plain">{ROLE_LABEL[profile!.role]}{profile!.role === 'seller' && profile!.seller_verified ? ', verified seller' : ''}</span>
        </div>
        {reset && <Notice kind="warn">Choose a new password below.</Notice>}
        <form className="panel stack" onSubmit={(e) => { e.preventDefault(); a.run(async () => { await updateMyProfile(uid, { full_name: name.trim(), city: city.trim(), phone: phone.trim() }); await refresh(); setSaved('Details saved.'); }); }}>
          <h2>Your details</h2>
          <label>Email<input value={session!.user.email || ''} disabled /></label>
          <label>Full name<input required value={name} onChange={(e) => setName(e.target.value)} /></label>
          <label>Phone or WhatsApp <span className="hint">Only you and our team can see this</span><input inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} /></label>
          <label>City<input value={city} onChange={(e) => setCity(e.target.value)} placeholder="e.g. Vijayawada" /></label>
          <button className="btn primary" disabled={a.busy}>Save details</button>
        </form>
        <form className="panel stack" onSubmit={(e) => { e.preventDefault(); a.run(async () => { if (pw.length < 8) throw new Error('Use a password of at least 8 characters.'); const { error } = await db().auth.updateUser({ password: pw }); if (error) throw error; setPw(''); setSaved('Password changed.'); if (reset) nav('/account', { replace: true }); }); }}>
          <h2>Password</h2>
          <label>New password<input type="password" autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} /></label>
          <button className="btn" disabled={a.busy}>Change password</button>
        </form>
        {a.error && <Notice kind="error">{a.error}</Notice>}
        {saved && !a.error && <Notice kind="ok">{saved}</Notice>}
        <p className="small">To sell or buy with another role, or to become a lawyer or surveyor reviewer, contact the DigiDecide team.</p>
        <Link className="btn" to={homeFor(profile!.role)}>Go to your dashboard</Link>
      </div>
    </div>
  );
}
