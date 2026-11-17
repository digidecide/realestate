import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';
import { PREVIEW } from '../lib/supabase';

function Brand() {
  return (
    <Link to="/" className="brand" aria-label="DigiDecide Real Estate, home">
      <svg viewBox="0 0 32 32" aria-hidden="true"><rect width="32" height="32" rx="7" fill="#2f4038" /><path d="M7 23 L12 9 L21 11 L25 22 Z" fill="none" stroke="#e9ede3" strokeWidth="2" strokeLinejoin="round" /><circle cx="16" cy="16" r="2.4" fill="#7fb04a" /></svg>
      <span>DigiDecide<span className="brand-long"> Real Estate</span></span>
    </Link>
  );
}

export default function Layout() {
  const { session, profile, signOut } = useAuth();
  const nav = useNavigate();
  const role = profile?.role;
  return (
    <>
      <header className="topbar">
        <div className="wrap">
          <Brand />
          <nav className="nav" aria-label="Main">
            <NavLink to="/search">Find land</NavLink>
            {role === 'seller' && <NavLink to="/seller">My listings</NavLink>}
            {role === 'buyer' && <NavLink to="/buyer">Saved and enquiries</NavLink>}
            {role === 'admin' && <NavLink to="/admin">Admin</NavLink>}
            {(role === 'lawyer' || role === 'surveyor') && <NavLink to="/reviews">My reviews</NavLink>}
            {session ? (
              <>
                <NavLink to="/account">Account</NavLink>
                <button className="btn light small" onClick={async () => { await signOut(); nav('/'); }}>Sign out</button>
              </>
            ) : (
              <>
                <NavLink to="/signin">Sign in</NavLink>
                <Link to="/signup" className="btn light small">Create account</Link>
              </>
            )}
          </nav>
        </div>
      </header>
      {PREVIEW && (
        <div className="preview-bar"><div className="wrap">Preview: these are sample listings. Sign-up, saving and uploads start working once the database is connected.</div></div>
      )}
      <main><Outlet /></main>
      <footer className="foot">
        <div className="wrap">
          <span>DigiDecide Real Estate, Vijayawada. Land listings and verification for Andhra Pradesh.</span>
          <span>Verification results are evidence to help your decision, not a guarantee of title. <a href="/enquiries/">Broker workspace</a></span>
        </div>
      </footer>
    </>
  );
}
