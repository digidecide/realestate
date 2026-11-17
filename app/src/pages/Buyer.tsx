import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';
import { enquiriesFor, favouriteProperties, setFavourite, updateRequest, verificationRequests } from '../lib/api';
import { date, errText } from '../lib/format';
import type { Enquiry, Property, VerificationRequest } from '../lib/types';
import { Empty, Notice, Pill, PropertyCard, RequireRole } from '../components/ui';

export function BuyerDashboard() {
  return <RequireRole><BuyerHome /></RequireRole>;
}

const KIND: Record<VerificationRequest['kind'], string> = { basic: 'Document consistency check', expert: 'Expert verification', lawyer: 'Lawyer title review' };

function BuyerHome() {
  const { session } = useAuth();
  const uid = session!.user.id;
  const [tab, setTab] = useState<'saved' | 'enquiries' | 'verification'>('saved');
  const [saved, setSaved] = useState<Property[]>([]);
  const [enqs, setEnqs] = useState<Enquiry[]>([]);
  const [reqs, setReqs] = useState<VerificationRequest[]>([]);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      setSaved(await favouriteProperties());
      setEnqs(await enquiriesFor(uid, 'buyer'));
      setReqs(await verificationRequests({ requestedBy: uid }));
    } catch (e) { setError(errText(e)); }
  }, [uid]);
  useEffect(() => { load(); }, [load]);

  return (
    <div className="wrap page">
      <div className="spread" style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: '2rem' }}>Saved and enquiries</h1>
        <Link className="btn primary" to="/search">Find land</Link>
      </div>
      {error && <Notice kind="error">{error}</Notice>}
      <div className="tabs" role="tablist">
        <button role="tab" aria-selected={tab === 'saved'} onClick={() => setTab('saved')}>Saved properties<span className="count">{saved.length}</span></button>
        <button role="tab" aria-selected={tab === 'enquiries'} onClick={() => setTab('enquiries')}>Your enquiries<span className="count">{enqs.length}</span></button>
        <button role="tab" aria-selected={tab === 'verification'} onClick={() => setTab('verification')}>Verification requests<span className="count">{reqs.length}</span></button>
      </div>

      {tab === 'saved' && (saved.length === 0 ? <Empty title="No saved properties"><p>Select “Save this property” on any listing to keep it here.</p></Empty> : (
        <div className="stack">
          {saved.map((p) => (
            <div key={p.id} className="stack-s">
              <PropertyCard p={p} />
              <button className="linkbtn" style={{ justifySelf: 'start' }} onClick={async () => { await setFavourite(p.id, false); load(); }}>Remove from saved</button>
            </div>
          ))}
        </div>
      ))}

      {tab === 'enquiries' && (enqs.length === 0 ? <Empty title="No enquiries yet"><p>Messages you send to sellers appear here with their replies.</p></Empty> : (
        <div className="panel flush">
          {enqs.map((e) => (
            <div className="item" key={e.id}>
              <div className="spread">
                <h3>{e.properties ? <Link to={`/property/${e.property_id}`}>{e.properties.title}</Link> : 'Property no longer listed'}</h3>
                <Pill status={e.status === 'new' ? 'pending' : e.status === 'closed' ? 'unable' : 'verified'}>{e.status === 'visit_scheduled' ? 'Site visit booked' : e.status === 'new' ? 'Sent' : e.status === 'replied' ? 'Seller replied' : 'Closed'}</Pill>
              </div>
              <p>{e.message}</p>
              <small>Sent {date(e.created_at)}.{e.wants_site_visit ? ` Site visit requested${e.preferred_date ? ' for ' + date(e.preferred_date) : ''}.` : ''}</small>
              {e.seller_reply && <Notice>Seller’s reply: {e.seller_reply}</Notice>}
            </div>
          ))}
        </div>
      ))}

      {tab === 'verification' && (reqs.length === 0 ? <Empty title="No verification requests"><p>Open a listing and select “Request verification”.</p></Empty> : (
        <div className="panel flush">
          {reqs.map((r) => (
            <div className="item" key={r.id}>
              <div className="spread">
                <h3>{r.properties ? <Link to={`/property/${r.property_id}`}>{r.properties.title}</Link> : 'Property no longer listed'}</h3>
                <Pill status={r.status === 'completed' ? 'verified' : r.status === 'cancelled' ? 'unable' : 'pending'}>{r.status === 'in_review' ? 'In review' : r.status[0].toUpperCase() + r.status.slice(1)}</Pill>
              </div>
              <small>{KIND[r.kind]}, requested {date(r.created_at)}.</small>
              {r.staff_note && <p>Reviewer note: {r.staff_note}</p>}
              {r.status === 'requested' && <button className="linkbtn" style={{ justifySelf: 'start' }} onClick={async () => { await updateRequest(r.id, { status: 'cancelled' }); load(); }}>Cancel request</button>}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
