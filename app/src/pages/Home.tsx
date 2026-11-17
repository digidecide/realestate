import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { searchProperties } from '../lib/api';
import { TYPE_LABEL } from '../lib/labels';
import { SAMPLE } from '../lib/sample';
import type { Property, PropertyType } from '../lib/types';
import { PropertyCard, VerificationSheet } from '../components/ui';

export default function Home() {
  const nav = useNavigate();
  const [q, setQ] = useState('');
  const [type, setType] = useState<PropertyType | ''>('');
  const [recent, setRecent] = useState<Property[]>([]);

  useEffect(() => { searchProperties({}).then((r) => setRecent(r.slice(0, 4))).catch(() => setRecent([])); }, []);

  function go(e: FormEvent) {
    e.preventDefault();
    const sp = new URLSearchParams();
    if (q.trim()) sp.set('q', q.trim());
    if (type) sp.set('type', type);
    nav('/search' + (sp.toString() ? '?' + sp : ''));
  }

  return (
    <>
      <section className="hero">
        <div className="wrap">
          <div>
            <h1>Check the land before you pay the advance.</h1>
            <p className="lede">Plots and land in Vijayawada, Guntur and Amaravati, each listed with its survey number, documents and a twelve-point verification record you can read for yourself.</p>
            <form onSubmit={go} role="search">
              <input aria-label="Village, mandal or survey number" placeholder="Village, mandal or survey number" value={q} onChange={(e) => setQ(e.target.value)} />
              <select aria-label="Land type" value={type} onChange={(e) => setType(e.target.value as PropertyType | '')}>
                <option value="">Any land type</option>
                {Object.entries(TYPE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
              <button className="btn primary" type="submit">Search land</button>
            </form>
          </div>
          <div aria-hidden="true">
            <VerificationSheet checks={SAMPLE[2].verification_checks} />
            <p className="sheet-caption">The verification sheet for a sample commercial plot in Thullur: 6 points verified, 2 pending, 4 not yet checked.</p>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="wrap">
          <div className="spread" style={{ marginBottom: 18 }}>
            <h2>Recently listed</h2>
            <Link to="/search">See all listings</Link>
          </div>
          <div className="stack">
            {recent.map((p) => <PropertyCard key={p.id} p={p} />)}
            {recent.length === 0 && <p className="muted">No listings yet. Sellers can add the first one.</p>}
          </div>
        </div>
      </section>

      <section className="section">
        <div className="wrap">
          <h2>How it works</h2>
          <div className="roles">
            <div>
              <h3>If you are buying</h3>
              <ul>
                <li>Search by place, budget, size and land type</li>
                <li>See the survey number, approvals and verification sheet</li>
                <li>Ask for a detailed verification or a lawyer’s title review</li>
                <li>Contact the seller and book a site visit</li>
              </ul>
            </div>
            <div>
              <h3>If you are selling</h3>
              <ul>
                <li>List free with the survey number and a map pin</li>
                <li>Upload photos, videos and land documents</li>
                <li>Request verification so buyers trust the listing</li>
                <li>Answer enquiries from one place</li>
              </ul>
            </div>
            <div>
              <h3>Who checks the land</h3>
              <ul>
                <li>Documents are compared with MeeBhoomi and registration records</li>
                <li>A land surveyor checks boundaries and road access</li>
                <li>An independent lawyer reviews the title</li>
                <li>Every result shows its date and source documents</li>
              </ul>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
