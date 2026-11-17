import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';
import {
  allProperties, allUsers, documentsToReview, getProperty, listDocuments, openDocument, reviewDocument, reviewProperty,
  saveCheck, setUser, updateRequest, verificationRequests,
} from '../lib/api';
import { CHECK_LABEL, DOC_LABEL, LISTING_LABEL, ROLE_LABEL, TWELVE_POINTS, VERIF_LABEL } from '../lib/labels';
import { date, errText, place, rupees, size } from '../lib/format';
import type { CheckStatus, Profile, Property, PropertyDocument, Role, VerificationRequest, VerificationStatus } from '../lib/types';
import { Empty, Notice, ParcelStrip, Pill, RequireRole, VerifPill, VerificationSheet, useAction } from '../components/ui';

const KIND: Record<VerificationRequest['kind'], string> = { basic: 'Document consistency check', expert: 'Expert verification', lawyer: 'Lawyer title review' };

export function AdminDashboard() {
  return <RequireRole roles={['admin']}><AdminHome /></RequireRole>;
}

type Tab = 'review' | 'listings' | 'verification' | 'documents' | 'users';

function AdminHome() {
  const [tab, setTab] = useState<Tab>('review');
  const [props, setProps] = useState<Property[]>([]);
  const [users, setUsers] = useState<Profile[]>([]);
  const [reqs, setReqs] = useState<VerificationRequest[]>([]);
  const [docs, setDocs] = useState<Awaited<ReturnType<typeof documentsToReview>>>([]);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      const [p, u, r, d] = await Promise.all([allProperties(), allUsers(), verificationRequests(), documentsToReview()]);
      setProps(p); setUsers(u); setReqs(r); setDocs(d);
    } catch (e) { setError(errText(e)); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const byId = useMemo(() => new Map(users.map((u) => [u.id, u])), [users]);
  const pending = props.filter((p) => p.listing_status === 'pending');
  const openReqs = reqs.filter((r) => !['completed', 'cancelled'].includes(r.status));

  return (
    <div className="wrap page">
      <h1 style={{ fontSize: '2rem', marginBottom: 20 }}>Admin</h1>
      <div className="stats">
        <div className="stat"><b>{pending.length}</b><span>Listings to review</span></div>
        <div className="stat"><b>{props.filter((p) => p.listing_status === 'approved').length}</b><span>Live listings</span></div>
        <div className="stat"><b>{openReqs.length}</b><span>Open verification requests</span></div>
        <div className="stat"><b>{docs.length}</b><span>Documents to review</span></div>
        <div className="stat"><b>{users.length}</b><span>Users ({users.filter((u) => u.role === 'seller').length} sellers)</span></div>
      </div>
      {error && <Notice kind="error">{error}</Notice>}
      <div className="tabs" role="tablist">
        {([['review', 'Listings to review', pending.length], ['listings', 'All listings', props.length], ['verification', 'Verification requests', openReqs.length], ['documents', 'Documents', docs.length], ['users', 'Users', users.length]] as [Tab, string, number][]).map(([k, l, n]) => (
          <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)}>{l}<span className="count">{n}</span></button>
        ))}
      </div>

      {tab === 'review' && (pending.length === 0 ? <Empty title="Nothing to review"><p>New and edited listings appear here before they go live.</p></Empty> : (
        <div className="panel flush">{pending.map((p) => <ListingReview key={p.id} p={p} seller={byId.get(p.seller_id)} onDone={load} />)}</div>
      ))}

      {tab === 'listings' && (
        <div className="panel flush table-wrap">
          <table>
            <thead><tr><th>Property</th><th>Seller</th><th>Listing</th><th>Verification</th><th>Featured</th><th>Checks</th></tr></thead>
            <tbody>
              {props.map((p) => (
                <tr key={p.id}>
                  <td><Link to={`/property/${p.id}`}>{p.title}</Link><br /><small>{rupees(p.price)}, {place(p)}</small></td>
                  <td>{byId.get(p.seller_id)?.full_name || 'Unknown'}</td>
                  <td>
                    <select aria-label="Listing status" value={p.listing_status} onChange={async (e) => { await reviewProperty(p.id, { listing_status: e.target.value as Property['listing_status'] }); load(); }}>
                      {Object.entries(LISTING_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
                    </select>
                  </td>
                  <td>
                    <select aria-label="Verification result" value={p.verification_status} onChange={async (e) => { await reviewProperty(p.id, { verification_status: e.target.value as VerificationStatus }); load(); }}>
                      {Object.entries(VERIF_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
                    </select>
                  </td>
                  <td><input type="checkbox" aria-label="Featured" checked={p.featured} onChange={async (e) => { await reviewProperty(p.id, { featured: e.target.checked }); load(); }} /></td>
                  <td><ParcelStrip checks={p.verification_checks} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'verification' && (reqs.length === 0 ? <Empty title="No verification requests yet" /> : (
        <div className="panel flush">{reqs.map((r) => <RequestRow key={r.id} r={r} users={users} byId={byId} onDone={load} />)}</div>
      ))}

      {tab === 'documents' && (docs.length === 0 ? <Empty title="No documents waiting"><p>Seller uploads waiting for a first look appear here.</p></Empty> : (
        <div className="panel flush">{docs.map((d) => <DocReview key={d.id} d={d} title={d.properties?.title} onDone={load} />)}</div>
      ))}

      {tab === 'users' && (
        <div className="panel flush table-wrap">
          <table>
            <thead><tr><th>Name</th><th>Role</th><th>Seller ID checked</th><th>City</th><th>Joined</th></tr></thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id}>
                  <td>{u.full_name || 'No name'}</td>
                  <td>
                    <select aria-label="Role" value={u.role} onChange={async (e) => { try { await setUser(u.id, { role: e.target.value as Role }); load(); } catch (er) { setError(errText(er)); } }}>
                      {Object.entries(ROLE_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
                    </select>
                  </td>
                  <td>{u.role === 'seller' ? <input type="checkbox" aria-label="Seller verified" checked={u.seller_verified} onChange={async (e) => { await setUser(u.id, { seller_verified: e.target.checked }); load(); }} /> : <small>Not a seller</small>}</td>
                  <td>{u.city}</td>
                  <td>{date(u.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function ListingReview({ p, seller, onDone }: { p: Property; seller?: Profile; onDone: () => void }) {
  const [note, setNote] = useState('');
  const a = useAction();
  return (
    <div className="item">
      <div className="spread">
        <h3><Link to={`/property/${p.id}`}>{p.title}</Link></h3>
        <VerifPill status={p.verification_status} />
      </div>
      <small>{rupees(p.price)}, {size(p.size_value, p.size_unit)}, survey no. {p.survey_number || 'not given'}, {place(p) || 'place not set'}. Seller {seller?.full_name || 'unknown'}{seller?.role === 'seller' && !seller.seller_verified ? ' (ID not checked yet)' : ''}. {(p.property_media || []).length} photos and videos. {p.lat == null ? 'No map pin.' : 'Map pin set.'}</small>
      <div className="row">
        <input style={{ flex: 1, minWidth: 220 }} aria-label="Note to seller" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Note to the seller if changes are needed" />
        <button className="btn small primary" disabled={a.busy} onClick={() => a.run(async () => { await reviewProperty(p.id, { listing_status: 'approved', review_note: '' }); onDone(); })}>Approve and publish</button>
        <button className="btn small" disabled={a.busy} onClick={() => a.run(async () => { if (!note.trim()) throw new Error('Write a note so the seller knows what to change.'); await reviewProperty(p.id, { listing_status: 'rejected', review_note: note.trim() }); onDone(); })}>Ask for changes</button>
      </div>
      {a.error && <Notice kind="error">{a.error}</Notice>}
    </div>
  );
}

function RequestRow({ r, users, byId, onDone }: { r: VerificationRequest; users: Profile[]; byId: Map<string, Profile>; onDone: () => void }) {
  const a = useAction();
  const lawyers = users.filter((u) => u.role === 'lawyer');
  const surveyors = users.filter((u) => u.role === 'surveyor');
  const assign = (v: Partial<VerificationRequest>) => a.run(async () => {
    const next = { ...r, ...v };
    await updateRequest(r.id, { ...v, status: r.status === 'requested' && (next.assigned_lawyer || next.assigned_surveyor) ? 'assigned' : r.status });
    onDone();
  });
  return (
    <div className="item">
      <div className="spread">
        <h3>{r.properties?.title || 'Removed property'}</h3>
        <Pill status={r.status === 'completed' ? 'verified' : r.status === 'cancelled' ? 'unable' : 'pending'}>{r.status.replace('_', ' ')}</Pill>
      </div>
      <small>{KIND[r.kind]}, requested {date(r.created_at)} by {byId.get(r.requested_by)?.full_name || 'a user'} ({ROLE_LABEL[byId.get(r.requested_by)?.role || 'buyer']}). Survey no. {r.properties?.survey_number || 'not given'}.</small>
      {r.note && <p>Request note: {r.note}</p>}
      <div className="row">
        <label style={{ minWidth: 200 }}>Lawyer
          <select value={r.assigned_lawyer || ''} onChange={(e) => assign({ assigned_lawyer: e.target.value || null })}>
            <option value="">Not assigned</option>{lawyers.map((u) => <option key={u.id} value={u.id}>{u.full_name}</option>)}
          </select>
        </label>
        <label style={{ minWidth: 200 }}>Land surveyor
          <select value={r.assigned_surveyor || ''} onChange={(e) => assign({ assigned_surveyor: e.target.value || null })}>
            <option value="">Not assigned</option>{surveyors.map((u) => <option key={u.id} value={u.id}>{u.full_name}</option>)}
          </select>
        </label>
        <label style={{ minWidth: 160 }}>Status
          <select value={r.status} onChange={(e) => a.run(async () => { await updateRequest(r.id, { status: e.target.value as VerificationRequest['status'] }); onDone(); })}>
            {['requested', 'assigned', 'in_review', 'completed', 'cancelled'].map((s) => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
          </select>
        </label>
        <Link className="btn small" to={`/review/${r.id}`} style={{ alignSelf: 'end' }}>Open the twelve-point review</Link>
      </div>
      {lawyers.length + surveyors.length === 0 && <small>No lawyers or surveyors yet. Give a user that role in the Users tab.</small>}
      {a.error && <Notice kind="error">{a.error}</Notice>}
    </div>
  );
}

function DocReview({ d, title, onDone }: { d: PropertyDocument; title?: string; onDone: () => void }) {
  const [note, setNote] = useState(d.review_note);
  const a = useAction();
  return (
    <div className="item">
      <div className="spread"><h3>{DOC_LABEL[d.doc_type]}</h3><small>{title}</small></div>
      <small>{d.file_name}, uploaded {date(d.created_at)}.</small>
      <div className="row">
        <button className="btn small" onClick={() => a.run(() => openDocument(d.path))}>Open document</button>
        <input style={{ flex: 1, minWidth: 200 }} aria-label="Review note" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Note, e.g. page 2 missing" />
        <button className="btn small primary" onClick={() => a.run(async () => { await reviewDocument(d.id, 'accepted', note.trim()); onDone?.(); })}>Accept</button>
        <button className="btn small" onClick={() => a.run(async () => { await reviewDocument(d.id, 'rejected', note.trim()); onDone?.(); })}>Reject</button>
      </div>
      {a.error && <Notice kind="error">{a.error}</Notice>}
    </div>
  );
}

// ---------------------------------------------------------------- expert review (lawyer, surveyor, admin)

export function ReviewsDashboard() {
  return <RequireRole roles={['lawyer', 'surveyor', 'admin']}><ReviewsHome /></RequireRole>;
}

function ReviewsHome() {
  const { session } = useAuth();
  const [reqs, setReqs] = useState<VerificationRequest[]>([]);
  const [error, setError] = useState('');
  useEffect(() => { verificationRequests({ assignedTo: session!.user.id }).then(setReqs).catch((e) => setError(errText(e))); }, [session]);
  return (
    <div className="wrap page">
      <h1 style={{ fontSize: '2rem', marginBottom: 20 }}>Properties assigned to you</h1>
      {error && <Notice kind="error">{error}</Notice>}
      {reqs.length === 0 ? <Empty title="Nothing assigned yet"><p>When the DigiDecide team assigns you a property, it appears here.</p></Empty> : (
        <div className="panel flush">
          {reqs.map((r) => (
            <div className="item" key={r.id}>
              <div className="spread"><h3>{r.properties?.title}</h3><Pill status={r.status === 'completed' ? 'verified' : 'pending'}>{r.status.replace('_', ' ')}</Pill></div>
              <small>{KIND[r.kind]}. Survey no. {r.properties?.survey_number || 'not given'}, {r.properties?.village}, {r.properties?.district}. Assigned request from {date(r.created_at)}.</small>
              <Link className="btn small" style={{ justifySelf: 'start' }} to={`/review/${r.id}`}>Open the review</Link>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function ReviewPage() {
  return <RequireRole roles={['lawyer', 'surveyor', 'admin']}><Review /></RequireRole>;
}

function Review() {
  const { id = '' } = useParams();
  const { session } = useAuth();
  const [req, setReq] = useState<VerificationRequest | null>(null);
  const [p, setP] = useState<Property | null>(null);
  const [docs, setDocs] = useState<PropertyDocument[]>([]);
  const [point, setPoint] = useState<number | null>(null);
  const [status, setStatus] = useState<CheckStatus>('not_started');
  const [note, setNote] = useState('');
  const [staffNote, setStaffNote] = useState('');
  const [error, setError] = useState('');
  const a = useAction();

  const load = useCallback(async () => {
    try {
      const all = await verificationRequests();
      const r = all.find((x) => x.id === id) || null;
      setReq(r);
      if (r) {
        setStaffNote(r.staff_note);
        setP(await getProperty(r.property_id));
        setDocs(await listDocuments(r.property_id));
      }
    } catch (e) { setError(errText(e)); }
  }, [id]);
  useEffect(() => { load(); }, [load]);

  function pick(n: number) {
    const c = p?.verification_checks?.find((x) => x.point === n);
    setPoint(n); setStatus(c?.status || 'not_started'); setNote(c?.note || '');
  }

  if (error) return <div className="wrap page"><Notice kind="error">{error}</Notice></div>;
  if (!req || !p) return <div className="wrap page muted">Loading…</div>;
  const pt = TWELVE_POINTS.find((x) => x.n === point);
  const mine = session!.user.id;
  const roleHere = req.assigned_lawyer === mine ? 'lawyer' : req.assigned_surveyor === mine ? 'surveyor' : 'admin';

  return (
    <div className="wrap page">
      <div className="stack" style={{ gap: 24 }}>
        <div className="spread">
          <div className="stack-s">
            <h1 style={{ fontSize: '1.9rem' }}>{p.title}</h1>
            <small>Survey no. {p.survey_number || 'not given'}, {place(p)}. {KIND[req.kind]}. You are reviewing as {roleHere}.</small>
          </div>
          <Link className="btn" to={`/property/${p.id}`}>View listing</Link>
        </div>

        <section className="stack">
          <h2>Twelve-point verification</h2>
          <p className="small">Select a point to record its result. Buyers see each result with its date.</p>
          <VerificationSheet checks={p.verification_checks} onPick={pick} />
          {pt && (
            <form className="panel stack" onSubmit={(e) => { e.preventDefault(); a.run(async () => { await saveCheck(p.id, pt.n, status, note.trim()); setPoint(null); await load(); }); }}>
              <h3>{pt.n}. {pt.title}</h3>
              <small>Check against: {pt.source}</small>
              <div className="grid2">
                <label>Result<select value={status} onChange={(e) => setStatus(e.target.value as CheckStatus)}>{Object.entries(CHECK_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></label>
                <label>Finding <span className="hint">Shown to buyers</span><input value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. EC 1990–2026 shows no charges" /></label>
              </div>
              {a.error && <Notice kind="error">{a.error}</Notice>}
              <div className="row"><button className="btn primary" disabled={a.busy}>Save result</button><button type="button" className="btn" onClick={() => setPoint(null)}>Cancel</button></div>
            </form>
          )}
        </section>

        <section className="panel stack">
          <h2>Seller’s documents</h2>
          {docs.length === 0 ? <p>The seller has not uploaded documents yet.</p> : docs.map((d) => <DocReview key={d.id} d={d} onDone={load} />)}
        </section>

        <section className="panel stack">
          <h2>Finish the review</h2>
          <label>Note to the buyer and seller<textarea value={staffNote} onChange={(e) => setStaffNote(e.target.value)} placeholder="Summary of what was checked and anything still open" /></label>
          <div className="row">
            <button className="btn" disabled={a.busy} onClick={() => a.run(async () => { await updateRequest(req.id, { staff_note: staffNote.trim(), status: 'in_review' }); await load(); })}>Save as in review</button>
            <button className="btn primary" disabled={a.busy} onClick={() => a.run(async () => { await updateRequest(req.id, { staff_note: staffNote.trim(), status: 'completed' }); await load(); })}>Mark review complete</button>
          </div>
          {roleHere === 'admin' && (
            <label style={{ maxWidth: 320 }}>Overall result shown on the listing
              <select value={p.verification_status} onChange={(e) => a.run(async () => { await reviewProperty(p.id, { verification_status: e.target.value as VerificationStatus }); await load(); })}>
                {Object.entries(VERIF_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
              </select>
            </label>
          )}
          {roleHere !== 'admin' && <small>The DigiDecide team sets the overall result on the listing after your review.</small>}
          {a.error && <Notice kind="error">{a.error}</Notice>}
          <small>Current listing result: {VERIF_LABEL[p.verification_status]}. Listing status: {LISTING_LABEL[p.listing_status]}.</small>
        </section>
      </div>
    </div>
  );
}
