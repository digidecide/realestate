import { useState, type ReactNode } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';
import { CHECK_LABEL, TWELVE_POINTS, VERIF_LABEL } from '../lib/labels';
import { mediaUrl, sortedMedia } from '../lib/api';
import { place, rupees, size } from '../lib/format';
import { PREVIEW } from '../lib/supabase';
import type { Check, Property, Role, VerificationStatus } from '../lib/types';

export function ParcelIcon() {
  return (
    <svg viewBox="0 0 64 48" fill="none" aria-hidden="true">
      <path d="M6 40 L16 8 L44 6 L58 38 Z" stroke="currentColor" strokeWidth="2.5" strokeLinejoin="round" />
      <path d="M16 8 L30 42 M44 6 L30 42" stroke="currentColor" strokeWidth="1.5" strokeDasharray="3 3" />
    </svg>
  );
}

export function Pill({ status, children }: { status?: string; children: ReactNode }) {
  return <span className={'pill ' + (status || '')}>{children}</span>;
}

export function VerifPill({ status }: { status: VerificationStatus }) {
  return <Pill status={status}>{VERIF_LABEL[status]}</Pill>;
}

function checkMap(checks: Check[] = []) {
  const m = new Map<number, Check>();
  checks.forEach((c) => m.set(c.point, c));
  return m;
}

/** Twelve small cells, one per verification point, coloured by result. */
export function ParcelStrip({ checks }: { checks?: Check[] }) {
  const m = checkMap(checks);
  const done = (checks || []).filter((c) => c.status === 'verified').length;
  return (
    <div className="strip-wrap">
      <div className="strip" role="img" aria-label={`${done} of 12 checks verified`}>
        {TWELVE_POINTS.map((p) => <i key={p.n} className={m.get(p.n)?.status || ''} title={`${p.n}. ${p.title}: ${CHECK_LABEL[m.get(p.n)?.status || 'not_started']}`} />)}
      </div>
      <small>{done} of 12 checks verified</small>
    </div>
  );
}

/** The full twelve-point sheet, laid out like a survey map sheet. */
export function VerificationSheet({ checks, onPick }: { checks?: Check[]; onPick?: (n: number) => void }) {
  const m = checkMap(checks);
  return (
    <div className="sheet">
      {TWELVE_POINTS.map((p) => {
        const c = m.get(p.n);
        const st = c?.status || 'not_started';
        const inner = (
          <>
            <span className="no">{p.n}</span>
            <h4>{p.title}</h4>
            <small>{CHECK_LABEL[st]}{c?.note ? ': ' + c.note : ''}</small>
          </>
        );
        return onPick ? (
          <button key={p.n} type="button" className={'cell ' + st} onClick={() => onPick(p.n)} style={{ textAlign: 'left', border: 0, font: 'inherit', cursor: 'pointer', color: 'inherit' }}>{inner}</button>
        ) : (
          <div key={p.n} className={'cell ' + st}>{inner}</div>
        );
      })}
    </div>
  );
}

export function PropertyCard({ p }: { p: Property }) {
  const first = sortedMedia(p).find((m) => m.kind === 'photo');
  return (
    <Link to={`/property/${p.id}`} className={'listing' + (p.featured ? ' featured' : '')}>
      <div className="thumb">
        {first && !PREVIEW ? <img src={mediaUrl(first.path)} alt="" loading="lazy" /> : <ParcelIcon />}
      </div>
      <div className="body">
        <div className="spread">
          <span className="price">{rupees(p.price)}</span>
          <VerifPill status={p.verification_status} />
        </div>
        <h3>{p.title}</h3>
        <div className="facts">
          <span><b>{size(p.size_value, p.size_unit)}</b></span>
          <span>{place(p)}</span>
          {p.survey_number && <span>Survey no. <b>{p.survey_number}</b></span>}
          {p.approvals.length > 0 && <span>{p.approvals.join(', ')} approved</span>}
          {p.availability !== 'available' && <span><b>{p.availability === 'sold' ? 'Sold' : 'Under offer'}</b></span>}
        </div>
        <ParcelStrip checks={p.verification_checks} />
      </div>
    </Link>
  );
}

export function Empty({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="empty">
      <ParcelIcon />
      <h3>{title}</h3>
      {children}
    </div>
  );
}

export function Notice({ kind, children }: { kind?: 'error' | 'ok' | 'warn'; children: ReactNode }) {
  return <div className={'notice ' + (kind || '')} role={kind === 'error' ? 'alert' : 'status'}>{children}</div>;
}

/** Shows children only to signed-in users with one of the given roles. */
export function RequireRole({ roles, children }: { roles?: Role[]; children: ReactNode }) {
  const { session, profile, loading } = useAuth();
  if (PREVIEW) return <div className="wrap page"><Notice kind="warn">This page needs an account. Accounts open once the database is connected; for now you can browse the sample listings.</Notice></div>;
  if (loading) return <div className="wrap page muted">Loading…</div>;
  if (!session) return <Navigate to="/signin" replace />;
  if (!profile) return <div className="wrap page"><Notice kind="error">Your profile could not be loaded. Sign out and sign in again.</Notice></div>;
  if (roles && !roles.includes(profile.role)) return <div className="wrap page"><Notice kind="warn">This page is for {roles.join(' or ')} accounts. Your account is a {profile.role} account.</Notice></div>;
  return <>{children}</>;
}

/** Runs an async action with a busy flag and an error message. */
export function useAction() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const run = async (fn: () => Promise<void>) => {
    setBusy(true); setError('');
    try { await fn(); } catch (e) { setError(e && typeof e === 'object' && 'message' in e ? String((e as { message: unknown }).message) : 'Something went wrong.'); }
    setBusy(false);
  };
  return { busy, error, setError, run };
}
