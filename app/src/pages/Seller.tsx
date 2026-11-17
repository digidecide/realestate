import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';
import {
  deleteDocument, deleteMedia, deleteProperty, openDocument, enquiriesFor, getProperty, listDocuments, mediaUrl, myProperties,
  requestVerification, saveProperty, sortedMedia, updateEnquiry, uploadDocument, uploadMedia, verificationRequests, type PropertyInput,
} from '../lib/api';
import { APPROVALS, AVAIL_LABEL, DISTRICTS, DOC_LABEL, LISTING_LABEL, TYPE_LABEL, UNIT_LABEL } from '../lib/labels';
import { date, errText, place, rupees, size } from '../lib/format';
import type { DocType, Enquiry, Property, PropertyDocument, VerificationRequest } from '../lib/types';
import { Empty, Notice, ParcelStrip, Pill, RequireRole, VerifPill, useAction } from '../components/ui';
import { parseCoords, PinPicker } from '../components/Maps';

export function SellerDashboard() {
  return <RequireRole roles={['seller', 'admin']}><SellerHome /></RequireRole>;
}

function SellerHome() {
  const { session, profile } = useAuth();
  const uid = session!.user.id;
  const [tab, setTab] = useState<'listings' | 'enquiries' | 'verification'>('listings');
  const [props, setProps] = useState<Property[]>([]);
  const [enqs, setEnqs] = useState<Enquiry[]>([]);
  const [reqs, setReqs] = useState<VerificationRequest[]>([]);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      const ps = await myProperties(uid);
      setProps(ps);
      setEnqs(await enquiriesFor(uid, 'seller'));
      setReqs(await verificationRequests({ propertyIds: ps.map((p) => p.id) }));
    } catch (e) { setError(errText(e)); }
  }, [uid]);
  useEffect(() => { load(); }, [load]);

  const fresh = enqs.filter((e) => e.status === 'new').length;
  return (
    <div className="wrap page">
      <div className="spread" style={{ marginBottom: 20 }}>
        <div className="stack-s">
          <h1 style={{ fontSize: '2rem' }}>Your listings</h1>
          {profile && !profile.seller_verified && <small>Your seller account is not verified yet. Our team checks your ID before your first listing goes live.</small>}
        </div>
        <Link className="btn primary" to="/seller/property/new">Add a property</Link>
      </div>
      <div className="stats">
        <div className="stat"><b>{props.filter((p) => p.listing_status === 'approved').length}</b><span>Live listings</span></div>
        <div className="stat"><b>{props.filter((p) => p.listing_status === 'pending').length}</b><span>Waiting for review</span></div>
        <div className="stat"><b>{fresh}</b><span>New enquiries</span></div>
        <div className="stat"><b>{props.filter((p) => p.verification_status === 'verified').length}</b><span>Verified</span></div>
      </div>
      {error && <Notice kind="error">{error}</Notice>}
      <div className="tabs" role="tablist">
        <button role="tab" aria-selected={tab === 'listings'} onClick={() => setTab('listings')}>Properties<span className="count">{props.length}</span></button>
        <button role="tab" aria-selected={tab === 'enquiries'} onClick={() => setTab('enquiries')}>Buyer enquiries<span className="count">{enqs.length}</span></button>
        <button role="tab" aria-selected={tab === 'verification'} onClick={() => setTab('verification')}>Verification<span className="count">{reqs.length}</span></button>
      </div>

      {tab === 'listings' && (props.length === 0 ? (
        <Empty title="Add your first property"><p>Listing is free. Add the survey number and a map pin so buyers can trust it.</p><Link className="btn primary" to="/seller/property/new">Add a property</Link></Empty>
      ) : (
        <div className="panel flush">
          {props.map((p) => (
            <div className="item" key={p.id}>
              <div className="spread">
                <div className="stack-s grow">
                  <div className="row"><Pill status={p.listing_status}>{LISTING_LABEL[p.listing_status]}</Pill><VerifPill status={p.verification_status} />{p.availability !== 'available' && <span className="pill plain">{AVAIL_LABEL[p.availability]}</span>}</div>
                  <h3>{p.title}</h3>
                  <small>{rupees(p.price)}, {size(p.size_value, p.size_unit)}, {place(p) || 'place not set'}. Updated {date(p.updated_at)}.</small>
                  {p.listing_status === 'rejected' && p.review_note && <Notice kind="warn">Changes needed: {p.review_note}</Notice>}
                </div>
                <ParcelStrip checks={p.verification_checks} />
              </div>
              <div className="row">
                <Link className="btn small" to={`/seller/property/${p.id}`}>Edit, photos and documents</Link>
                {p.listing_status === 'approved' && <Link className="btn small" to={`/property/${p.id}`}>View live listing</Link>}
                {p.verification_status === 'not_requested' && (
                  <button className="btn small" onClick={async () => { try { await requestVerification(p.id, 'basic', 'Requested by seller'); await load(); } catch (e) { setError(errText(e)); } }}>Request verification</button>
                )}
              </div>
            </div>
          ))}
        </div>
      ))}

      {tab === 'enquiries' && (enqs.length === 0 ? <Empty title="No enquiries yet"><p>Buyers’ messages about your properties appear here.</p></Empty> : (
        <div className="panel flush">{enqs.map((e) => <SellerEnquiry key={e.id} e={e} onChange={load} />)}</div>
      ))}

      {tab === 'verification' && (reqs.length === 0 ? <Empty title="No verification requests"><p>Request verification on a property so buyers see a checked record.</p></Empty> : (
        <div className="panel flush">
          {reqs.map((r) => (
            <div className="item" key={r.id}>
              <div className="spread"><h3>{r.properties?.title}</h3><Pill status={r.status === 'completed' ? 'verified' : 'pending'}>{r.status.replace('_', ' ')}</Pill></div>
              <small>{r.kind === 'basic' ? 'Document consistency check' : r.kind === 'expert' ? 'Expert verification' : 'Lawyer title review'}, requested {date(r.created_at)}{r.requested_by !== session!.user.id ? ' by a buyer' : ''}.</small>
              {r.staff_note && <p>Reviewer note: {r.staff_note}</p>}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

function SellerEnquiry({ e, onChange }: { e: Enquiry; onChange: () => void }) {
  const [reply, setReply] = useState(e.seller_reply);
  const a = useAction();
  const wa = e.phone.replace(/\D/g, '');
  return (
    <div className="item">
      <div className="spread">
        <h3>{e.buyer_name || 'Buyer'} about {e.properties?.title || 'your property'}</h3>
        <Pill status={e.status === 'new' ? 'pending' : e.status === 'closed' ? 'unable' : 'verified'}>{e.status.replace('_', ' ')}</Pill>
      </div>
      <p>{e.message}</p>
      <small>{date(e.created_at)}. Phone {e.phone || 'not given'}.{e.wants_site_visit ? ` Wants a site visit${e.preferred_date ? ' on ' + date(e.preferred_date) : ''}.` : ''}</small>
      <div className="row">
        {wa && <a className="btn small" href={`https://wa.me/${wa.length === 10 ? '91' + wa : wa}`} target="_blank" rel="noreferrer">WhatsApp</a>}
        {e.phone && <a className="btn small" href={`tel:${e.phone}`}>Call</a>}
      </div>
      <form className="row" onSubmit={(ev) => { ev.preventDefault(); a.run(async () => { await updateEnquiry(e.id, { seller_reply: reply.trim(), status: e.status === 'new' ? 'replied' : e.status }); onChange(); }); }}>
        <input className="grow" style={{ flex: 1, minWidth: 200 }} aria-label="Reply" value={reply} onChange={(ev) => setReply(ev.target.value)} placeholder="Reply to the buyer" />
        <button className="btn small">Send reply</button>
        <select aria-label="Status" value={e.status} style={{ width: 'auto' }} onChange={(ev) => a.run(async () => { await updateEnquiry(e.id, { status: ev.target.value as Enquiry['status'] }); onChange(); })}>
          <option value="new">New</option><option value="replied">Replied</option><option value="visit_scheduled">Site visit booked</option><option value="closed">Closed</option>
        </select>
      </form>
      {a.error && <Notice kind="error">{a.error}</Notice>}
    </div>
  );
}

// ---------------------------------------------------------------- property form

const EMPTY: PropertyInput = {
  title: '', description: '', type: 'residential_plot', price: 0, size_value: 0, size_unit: 'sq_yards',
  survey_number: '', village: '', mandal: '', district: '', state: 'Andhra Pradesh', lat: null, lng: null,
  approvals: [], approval_ref: '', road_access: '', listing_status: 'pending', availability: 'available',
};

export function PropertyForm() {
  return <RequireRole roles={['seller', 'admin']}><PropertyEditor /></RequireRole>;
}

function PropertyEditor() {
  const { id = 'new' } = useParams();
  const isNew = id === 'new';
  const { session } = useAuth();
  const uid = session!.user.id;
  const nav = useNavigate();
  const [v, setV] = useState<PropertyInput>(EMPTY);
  const [prop, setProp] = useState<Property | null>(null);
  const [coordText, setCoordText] = useState('');
  const [loaded, setLoaded] = useState(isNew);
  const [msg, setMsg] = useState('');
  const a = useAction();

  const reload = useCallback(async () => {
    if (isNew) return;
    const p = await getProperty(id);
    if (!p) { setLoaded(true); return; }
    setProp(p);
    const { id: _i, seller_id: _s, verification_status: _vs, featured: _f, review_note: _r, created_at: _c, updated_at: _u, property_media: _m, verification_checks: _vc, ...rest } = p;
    setV(rest);
    if (p.lat != null) setCoordText(`${p.lat}, ${p.lng}`);
    setLoaded(true);
  }, [id, isNew]);
  useEffect(() => { reload().catch((e) => { a.setError(errText(e)); setLoaded(true); }); }, [reload]); // eslint-disable-line react-hooks/exhaustive-deps

  const set = <K extends keyof PropertyInput>(k: K, val: PropertyInput[K]) => setV((o) => ({ ...o, [k]: val }));

  async function submit(e: FormEvent, asDraft = false) {
    e.preventDefault();
    await a.run(async () => {
      if (!(v.price > 0)) throw new Error('Enter the full asking price in rupees.');
      if (!(v.size_value > 0)) throw new Error('Enter the land size.');
      const newId = await saveProperty(isNew ? null : id, { ...v, listing_status: asDraft ? 'draft' : 'pending' });
      setMsg(asDraft ? 'Saved as a draft. Only you can see it.' : prop?.listing_status === 'approved' ? 'Changes saved. The listing goes back for a quick review before the changes show.' : 'Saved and sent for review. Add photos and documents below while you wait.');
      if (isNew) nav(`/seller/property/${newId}`, { replace: true }); else await reload();
    });
  }

  if (!loaded) return <div className="wrap page muted">Loading…</div>;
  if (!isNew && !prop) return <div className="wrap page"><Notice kind="error">This property was not found or is not yours.</Notice></div>;

  return (
    <div className="wrap page" style={{ maxWidth: 860 }}>
      <div className="stack" style={{ gap: 24 }}>
        <div className="spread">
          <h1 style={{ fontSize: '2rem' }}>{isNew ? 'Add a property' : 'Edit property'}</h1>
          {prop && <div className="row"><Pill status={prop.listing_status}>{LISTING_LABEL[prop.listing_status]}</Pill><VerifPill status={prop.verification_status} /></div>}
        </div>
        {prop?.listing_status === 'rejected' && prop.review_note && <Notice kind="warn">Changes needed: {prop.review_note}</Notice>}
        {msg && <Notice kind="ok">{msg}</Notice>}

        <form className="panel stack" style={{ gap: 28 }} onSubmit={(e) => submit(e)}>
          <fieldset>
            <legend>About the land</legend>
            <label>Listing title<input required minLength={3} maxLength={140} value={v.title} onChange={(e) => set('title', e.target.value)} placeholder="e.g. East-facing 200 sq. yard plot near Ganguru main road" /></label>
            <div className="grid2">
              <label>Land type<select value={v.type} onChange={(e) => set('type', e.target.value as PropertyInput['type'])}>{Object.entries(TYPE_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></label>
              <label>Availability<select value={v.availability} onChange={(e) => set('availability', e.target.value as PropertyInput['availability'])}>{Object.entries(AVAIL_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></label>
            </div>
            <div className="grid3">
              <label>Asking price <span className="hint">Full amount in ₹</span><input required inputMode="numeric" value={v.price || ''} onChange={(e) => set('price', Number(e.target.value.replace(/\D/g, '')))} placeholder="6300000" /></label>
              <label>Size<input required inputMode="decimal" value={v.size_value || ''} onChange={(e) => set('size_value', Number(e.target.value.replace(/[^\d.]/g, '')))} /></label>
              <label>Unit<select value={v.size_unit} onChange={(e) => set('size_unit', e.target.value as PropertyInput['size_unit'])}>{Object.entries(UNIT_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></label>
            </div>
            {v.price > 0 && <small>Shown to buyers as {rupees(v.price)}.</small>}
            <label>Description<textarea value={v.description} onChange={(e) => set('description', e.target.value)} placeholder="Facing, nearby landmarks, water and power, what is on the land" /></label>
          </fieldset>

          <fieldset>
            <legend>Survey and location</legend>
            <div className="grid2">
              <label>Survey number<input value={v.survey_number} onChange={(e) => set('survey_number', e.target.value)} placeholder="e.g. 112/2B" /></label>
              <label>Village<input value={v.village} onChange={(e) => set('village', e.target.value)} /></label>
              <label>Mandal<input value={v.mandal} onChange={(e) => set('mandal', e.target.value)} /></label>
              <label>District<select value={v.district} onChange={(e) => set('district', e.target.value)}><option value="">Choose district</option>{DISTRICTS.map((d) => <option key={d}>{d}</option>)}</select></label>
            </div>
            <label>Map pin <span className="hint">Paste coordinates or a Google Maps link, or select the spot on the map</span>
              <input value={coordText} onChange={(e) => { setCoordText(e.target.value); const c = parseCoords(e.target.value); if (c) { set('lat', c[0]); set('lng', c[1]); } }} placeholder="16.4794, 80.7181" />
            </label>
            <PinPicker lat={v.lat} lng={v.lng} onPick={(la, lo) => { set('lat', la); set('lng', lo); setCoordText(`${la}, ${lo}`); }} />
            {v.lat != null && <button type="button" className="linkbtn" style={{ justifySelf: 'start' }} onClick={() => { set('lat', null); set('lng', null); setCoordText(''); }}>Remove the pin</button>}
          </fieldset>

          <fieldset>
            <legend>Approvals and access</legend>
            <div className="row">
              {APPROVALS.map((ap) => (
                <label key={ap} className="check"><input type="checkbox" checked={v.approvals.includes(ap)} onChange={(e) => set('approvals', e.target.checked ? [...v.approvals, ap] : v.approvals.filter((x) => x !== ap))} />{ap}</label>
              ))}
            </div>
            <div className="grid2">
              <label>Approval or LP number<input value={v.approval_ref} onChange={(e) => set('approval_ref', e.target.value)} placeholder="e.g. LP 104/2019" /></label>
              <label>Road access<input value={v.road_access} onChange={(e) => set('road_access', e.target.value)} placeholder="e.g. 30 ft layout road on the east" /></label>
            </div>
          </fieldset>

          {a.error && <Notice kind="error">{a.error}</Notice>}
          <div className="row">
            <button className="btn primary" disabled={a.busy}>{a.busy ? 'Saving…' : isNew ? 'Save and send for review' : 'Save changes'}</button>
            {(isNew || prop?.listing_status === 'draft') && <button type="button" className="btn" disabled={a.busy} onClick={(e) => submit(e as unknown as FormEvent, true)}>Save as draft</button>}
            {!isNew && <button type="button" className="btn danger" style={{ marginLeft: 'auto' }} onClick={() => { if (confirm('Delete this property, its photos and documents? This cannot be undone.')) a.run(async () => { await deleteProperty(id); nav('/seller'); }); }}>Delete property</button>}
          </div>
          {isNew && <small>You can add photos, videos and documents after the first save.</small>}
        </form>

        {prop && <MediaSection uid={uid} prop={prop} onChange={reload} />}
        {prop && <DocumentsSection uid={uid} propertyId={prop.id} />}
      </div>
    </div>
  );
}

function DropZone({ accept, label, onFiles, busy }: { accept: string; label: string; onFiles: (f: File[]) => void; busy: boolean }) {
  const [over, setOver] = useState(false);
  const ref = useRef<HTMLInputElement>(null);
  return (
    <div className={'drop' + (over ? ' over' : '')}
      onDragOver={(e) => { e.preventDefault(); setOver(true); }} onDragLeave={() => setOver(false)}
      onDrop={(e) => { e.preventDefault(); setOver(false); onFiles(Array.from(e.dataTransfer.files)); }}>
      <p>{busy ? 'Uploading…' : label}</p>
      <button type="button" className="btn small" disabled={busy} onClick={() => ref.current?.click()}>Choose files</button>
      <input ref={ref} type="file" multiple accept={accept} hidden onChange={(e) => { onFiles(Array.from(e.target.files || [])); e.target.value = ''; }} />
    </div>
  );
}

function MediaSection({ uid, prop, onChange }: { uid: string; prop: Property; onChange: () => Promise<void> }) {
  const a = useAction();
  const media = sortedMedia(prop);
  return (
    <section className="panel stack">
      <div className="spread"><h2>Photos and videos</h2><small>{media.length} added</small></div>
      <DropZone accept="image/*,video/*" busy={a.busy} label="Drop photos or short videos here. Up to 50 MB each." onFiles={(files) => a.run(async () => {
        let pos = media.length;
        for (const f of files) await uploadMedia(uid, prop.id, f, pos++);
        await onChange();
      })} />
      {a.error && <Notice kind="error">{a.error}</Notice>}
      {media.length > 0 && (
        <div className="media-grid">
          {media.map((m) => (
            <figure key={m.id}>
              {m.kind === 'video' ? <video src={mediaUrl(m.path)} muted preload="metadata" /> : <img src={mediaUrl(m.path)} alt="" loading="lazy" />}
              <button type="button" className="btn small" onClick={() => a.run(async () => { await deleteMedia(m); await onChange(); })}>Remove</button>
            </figure>
          ))}
        </div>
      )}
      <small>The first photo is shown in search results. Photos and videos are public once the listing is live.</small>
    </section>
  );
}

function DocumentsSection({ uid, propertyId }: { uid: string; propertyId: string }) {
  const [docs, setDocs] = useState<PropertyDocument[]>([]);
  const [type, setType] = useState<DocType>('sale_deed');
  const a = useAction();
  const load = useCallback(() => listDocuments(propertyId).then(setDocs).catch((e) => a.setError(errText(e))), [propertyId]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, [load]);
  const have = new Set(docs.map((d) => d.doc_type));
  const core: DocType[] = ['sale_deed', 'link_documents', 'adangal_1b', 'passbook', 'ec', 'fmb_sketch'];
  const missing = core.filter((d) => !have.has(d));

  return (
    <section className="panel stack">
      <div className="spread"><h2>Land documents</h2><small>Private: only you, our team and the assigned reviewer can open them</small></div>
      {missing.length > 0 && <Notice kind="warn">Still needed for verification: {missing.map((d) => DOC_LABEL[d]).join(', ')}.</Notice>}
      <label>Document type<select value={type} onChange={(e) => setType(e.target.value as DocType)}>{Object.entries(DOC_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></label>
      <DropZone accept="application/pdf,image/*" busy={a.busy} label={`${DOC_LABEL[type]}: drop it here as a PDF or photo. Up to 20 MB.`} onFiles={(files) => a.run(async () => {
        for (const f of files) await uploadDocument(uid, propertyId, f, type);
        await load();
      })} />
      {a.error && <Notice kind="error">{a.error}</Notice>}
      {docs.length > 0 && (
        <div>
          {docs.map((d) => (
            <div className="doc-row" key={d.id}>
              <div className="stack-s">
                <b>{DOC_LABEL[d.doc_type]}</b>
                <small>{d.file_name}, uploaded {date(d.created_at)}.{d.review_note ? ' Reviewer: ' + d.review_note : ''}</small>
              </div>
              <div className="row">
                <Pill status={d.review_status === 'accepted' ? 'verified' : d.review_status === 'rejected' ? 'discrepancy' : 'pending'}>{d.review_status === 'accepted' ? 'Accepted' : d.review_status === 'rejected' ? 'Rejected' : 'Waiting for review'}</Pill>
                <button className="btn small" type="button" onClick={() => a.run(async () => { await openDocument(d.path); })}>Open</button>
                <button className="btn small danger" type="button" onClick={() => a.run(async () => { await deleteDocument(d); await load(); })}>Remove</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
