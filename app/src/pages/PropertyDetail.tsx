import { useEffect, useState, type FormEvent } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';
import { favouriteIds, getProperty, mediaUrl, requestVerification, sendEnquiry, setFavourite, sortedMedia } from '../lib/api';
import { AVAIL_LABEL, TWELVE_POINTS, TYPE_LABEL } from '../lib/labels';
import { date, errText, fullRupees, place, rupees, size } from '../lib/format';
import { PREVIEW } from '../lib/supabase';
import type { Property } from '../lib/types';
import { Empty, Notice, ParcelIcon, VerifPill, VerificationSheet, useAction } from '../components/ui';
import { googleMapsLink, PropertyMap } from '../components/Maps';

function riskFlags(p: Property): string[] {
  const f: string[] = [];
  if (!p.survey_number) f.push('No survey number given yet.');
  if (p.lat == null) f.push('No map pin, so the location has not been matched to the survey record.');
  if (p.type === 'approved_layout' && !p.approvals.some((a) => ['DTCP', 'APCRDA', 'VMRDA'].includes(a))) f.push('Listed as an approved layout, but no DTCP, APCRDA or VMRDA approval is recorded.');
  if (p.type === 'converted_na' && !p.approvals.includes('NA conversion')) f.push('Listed as converted land, but no conversion order is recorded.');
  if (!p.road_access) f.push('Road access is not described.');
  for (const c of p.verification_checks || []) {
    const t = TWELVE_POINTS.find((x) => x.n === c.point)?.title;
    if (c.status === 'discrepancy') f.push(`Discrepancy found in point ${c.point}, ${t}${c.note ? ': ' + c.note : '.'}`);
    if (c.status === 'unable') f.push(`Could not verify point ${c.point}, ${t}.`);
  }
  if (p.verification_status === 'not_requested') f.push('Nobody has requested verification for this listing yet.');
  return f;
}

export default function PropertyDetail() {
  const { id = '' } = useParams();
  const { session, profile } = useAuth();
  const [p, setP] = useState<Property | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [fav, setFav] = useState(false);

  useEffect(() => {
    setLoading(true);
    getProperty(id).then(setP).catch((e) => setError(errText(e))).finally(() => setLoading(false));
    if (session) favouriteIds().then((s) => setFav(s.has(id))).catch(() => {});
  }, [id, session]);

  if (loading) return <div className="wrap page muted">Loading…</div>;
  if (error) return <div className="wrap page"><Notice kind="error">{error}</Notice></div>;
  if (!p) return <div className="wrap page"><Empty title="This listing is not available"><p>It may have been removed or is waiting for review. <Link to="/search">Search other land</Link>.</p></Empty></div>;

  const media = sortedMedia(p);
  const flags = riskFlags(p);
  const isOwner = profile?.id === p.seller_id;
  const done = (p.verification_checks || []).filter((c) => c.status === 'verified').length;
  const lastCheck = (p.verification_checks || []).map((c) => c.updated_at).sort().pop();

  return (
    <div className="wrap page">
      <div className="detail">
        <div className="stack" style={{ gap: 28 }}>
          {media.length && !PREVIEW ? (
            <div className="gallery">
              {media.slice(0, 9).map((m) => (
                <div key={m.id}>{m.kind === 'video'
                  ? <video src={mediaUrl(m.path)} controls preload="metadata" />
                  : <a href={mediaUrl(m.path)} target="_blank" rel="noreferrer"><img src={mediaUrl(m.path)} alt={`Photo of ${p.title}`} loading="lazy" /></a>}</div>
              ))}
            </div>
          ) : <div className="gallery-empty"><div><ParcelIcon /><p>No photos yet</p></div></div>}

          <div className="stack-s">
            <div className="row"><VerifPill status={p.verification_status} />{p.availability !== 'available' && <span className="pill plain">{AVAIL_LABEL[p.availability]}</span>}{p.featured && <span className="pill plain">Featured</span>}</div>
            <h1 style={{ fontSize: 'clamp(1.6rem, 3vw, 2.3rem)' }}>{p.title}</h1>
            <p className="muted">{place(p)}</p>
          </div>

          {p.description && <p style={{ maxWidth: '68ch', whiteSpace: 'pre-line' }}>{p.description}</p>}

          <section className="stack-s">
            <h2>Land details</h2>
            <dl className="kv">
              <dt>Land type</dt><dd>{TYPE_LABEL[p.type]}</dd>
              <dt>Size</dt><dd>{size(p.size_value, p.size_unit)}</dd>
              <dt>Asking price</dt><dd>{fullRupees(p.price)}</dd>
              <dt>Survey number</dt><dd>{p.survey_number || 'Not given'}</dd>
              <dt>Village and mandal</dt><dd>{[p.village, p.mandal].filter(Boolean).join(', ') || 'Not given'}</dd>
              <dt>District</dt><dd>{p.district || 'Not given'}</dd>
              <dt>Approvals</dt><dd>{p.approvals.length ? p.approvals.join(', ') : 'None recorded'}{p.approval_ref ? ` (${p.approval_ref})` : ''}</dd>
              <dt>Road access</dt><dd>{p.road_access || 'Not described'}</dd>
              <dt>Listed</dt><dd>{date(p.created_at)}</dd>
            </dl>
          </section>

          <section className="stack">
            <div className="spread">
              <h2>Twelve-point verification</h2>
              <span className="muted">{done} of 12 verified{lastCheck ? `, last updated ${date(lastCheck)}` : ''}</span>
            </div>
            <VerificationSheet checks={p.verification_checks} />
            <p className="disclaimer">These checks compare the seller’s documents with government records and a site visit. They help you decide, but they are not a guarantee of legal ownership or clear title. Take independent legal advice before you pay.</p>
          </section>

          <section className="stack-s">
            <h2>Points to check</h2>
            {flags.length ? <ul style={{ margin: 0, paddingLeft: 20, display: 'grid', gap: 6 }}>{flags.map((f) => <li key={f}>{f}</li>)}</ul> : <p>No open points recorded for this listing.</p>}
          </section>

          {p.lat != null && p.lng != null && (
            <section className="stack-s">
              <div className="spread"><h2>Location</h2><a href={googleMapsLink(p.lat, p.lng)} target="_blank" rel="noreferrer">Open in Google Maps</a></div>
              <PropertyMap lat={p.lat} lng={p.lng} />
            </section>
          )}
        </div>

        <aside className="side">
          <div className="panel stack-s">
            <span style={{ font: '800 2rem/1 var(--head)' }}>{rupees(p.price)}</span>
            <small>{fullRupees(p.price)} for {size(p.size_value, p.size_unit)}</small>
            {session && !isOwner && (
              <button className="btn" onClick={async () => { const n = !fav; setFav(n); try { await setFavourite(p.id, n); } catch { setFav(!n); } }} aria-pressed={fav}>
                {fav ? 'Saved to your list' : 'Save this property'}
              </button>
            )}
            {isOwner && <Link className="btn" to={`/seller/property/${p.id}`}>Edit your listing</Link>}
          </div>
          {!isOwner && <EnquiryBox p={p} />}
          <VerifyBox p={p} onSent={() => getProperty(id).then(setP).catch(() => {})} />
        </aside>
      </div>
    </div>
  );
}

function SignInPrompt({ what }: { what: string }) {
  if (PREVIEW) return <Notice kind="warn">Available once accounts open. This is a sample listing.</Notice>;
  return <p><Link to="/signin">Sign in</Link> or <Link to="/signup">create an account</Link> to {what.toLowerCase()}.</p>;
}

function EnquiryBox({ p }: { p: Property }) {
  const { session, profile } = useAuth();
  const [msg, setMsg] = useState('Is this property still available? I would like to know more.');
  const [name, setName] = useState(profile?.full_name || '');
  const [phone, setPhone] = useState('');
  const [visit, setVisit] = useState(false);
  const [day, setDay] = useState('');
  const [sent, setSent] = useState(false);
  const a = useAction();
  useEffect(() => { if (profile?.full_name) setName(profile.full_name); }, [profile]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    await a.run(async () => {
      await sendEnquiry({ property_id: p.id, buyer_name: name.trim(), phone: phone.trim(), message: msg.trim(), wants_site_visit: visit, preferred_date: visit && day ? day : null });
      setSent(true);
    });
  }

  return (
    <div className="panel stack-s">
      <h3>Contact the seller</h3>
      {!session ? <SignInPrompt what="Contact the seller" /> : sent ? (
        <Notice kind="ok">Enquiry sent. The seller will reply to you here and may call you. You can follow it under Saved and enquiries.</Notice>
      ) : (
        <form className="stack-s" onSubmit={submit}>
          <label>Your name<input required value={name} onChange={(e) => setName(e.target.value)} /></label>
          <label>Phone or WhatsApp<input required inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+91" /></label>
          <label>Message<textarea required value={msg} onChange={(e) => setMsg(e.target.value)} /></label>
          <label className="check"><input type="checkbox" checked={visit} onChange={(e) => setVisit(e.target.checked)} /> I want to visit the site</label>
          {visit && <label>Preferred date<input type="date" value={day} onChange={(e) => setDay(e.target.value)} min={new Date().toISOString().slice(0, 10)} /></label>}
          {a.error && <Notice kind="error">{a.error}</Notice>}
          <button className="btn primary" disabled={a.busy}>{a.busy ? 'Sending…' : 'Send enquiry'}</button>
          <small>Your phone number is shared only with this seller.</small>
        </form>
      )}
    </div>
  );
}

function VerifyBox({ p, onSent }: { p: Property; onSent: () => void }) {
  const { session } = useAuth();
  const [kind, setKind] = useState<'basic' | 'expert' | 'lawyer'>('basic');
  const [note, setNote] = useState('');
  const [sent, setSent] = useState(false);
  const a = useAction();
  return (
    <div className="panel stack-s">
      <h3>Request verification</h3>
      <p className="small">Ask our team to run the twelve-point check on this land. You will see the result on this page.</p>
      {!session ? <SignInPrompt what="Request verification" /> : sent ? (
        <Notice kind="ok">Verification requested. We will assign a reviewer and update the sheet as each point is checked.</Notice>
      ) : (
        <form className="stack-s" onSubmit={(e) => { e.preventDefault(); a.run(async () => { await requestVerification(p.id, kind, note.trim()); setSent(true); onSent(); }); }}>
          <fieldset>
            <label className="check"><input type="radio" name="k" checked={kind === 'basic'} onChange={() => setKind('basic')} /> Document consistency check</label>
            <label className="check"><input type="radio" name="k" checked={kind === 'expert'} onChange={() => setKind('expert')} /> Expert document verification</label>
            <label className="check"><input type="radio" name="k" checked={kind === 'lawyer'} onChange={() => setKind('lawyer')} /> Lawyer-assisted title review</label>
          </fieldset>
          <label>Anything we should know<textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Optional" style={{ minHeight: 64 }} /></label>
          {a.error && <Notice kind="error">{a.error}</Notice>}
          <button className="btn" disabled={a.busy}>{a.busy ? 'Sending…' : 'Request verification'}</button>
          <small>Fees for expert and lawyer reviews will be confirmed before work starts.</small>
        </form>
      )}
    </div>
  );
}
