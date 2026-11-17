import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { searchProperties, type SearchFilters } from '../lib/api';
import { APPROVALS, DISTRICTS, TYPE_LABEL } from '../lib/labels';
import { errText } from '../lib/format';
import type { Property, PropertyType } from '../lib/types';
import { Empty, Notice, PropertyCard } from '../components/ui';
import { ResultsMap } from '../components/Maps';

const LAKH = 100000;

export default function Search() {
  const [sp, setSp] = useSearchParams();
  const f: SearchFilters = useMemo(() => ({
    q: sp.get('q') || '',
    district: sp.get('district') || '',
    type: (sp.get('type') || '') as PropertyType | '',
    minPrice: Number(sp.get('min') || 0) * LAKH,
    maxPrice: Number(sp.get('max') || 0) * LAKH,
    minSqyd: Number(sp.get('minsz') || 0),
    maxSqyd: Number(sp.get('maxsz') || 0),
    approval: sp.get('approval') || '',
    verifiedOnly: sp.get('verified') === '1',
    sort: (sp.get('sort') || 'newest') as SearchFilters['sort'],
  }), [sp]);
  const [items, setItems] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [view, setView] = useState<'list' | 'map'>('list');
  const [showFilters, setShowFilters] = useState(() => window.matchMedia('(min-width: 881px)').matches);
  const active = ['q', 'district', 'type', 'min', 'max', 'minsz', 'maxsz', 'approval', 'verified'].filter((k) => sp.get(k)).length;

  useEffect(() => {
    setLoading(true); setError('');
    searchProperties(f).then(setItems).catch((e) => setError(errText(e))).finally(() => setLoading(false));
  }, [f]);

  function set(k: string, v: string) {
    const n = new URLSearchParams(sp);
    if (v) n.set(k, v); else n.delete(k);
    setSp(n, { replace: true });
  }

  return (
    <div className="wrap page">
      <div className="search-layout">
        <div className="stack-s">
        <button type="button" className="btn filter-toggle" aria-expanded={showFilters} onClick={() => setShowFilters(!showFilters)}>{showFilters ? 'Hide filters' : `Filters${active ? ` (${active} on)` : ''}`}</button>
        {showFilters && <aside className="filters panel" aria-label="Filters">
          <label>Place or survey number
            <input value={sp.get('q') || ''} onChange={(e) => set('q', e.target.value)} placeholder="e.g. Ganguru or 112/2B" />
          </label>
          <label>District
            <select value={f.district} onChange={(e) => set('district', e.target.value)}>
              <option value="">All districts</option>
              {DISTRICTS.map((d) => <option key={d}>{d}</option>)}
            </select>
          </label>
          <label>Land type
            <select value={f.type} onChange={(e) => set('type', e.target.value)}>
              <option value="">Any land type</option>
              {Object.entries(TYPE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </label>
          <div className="grid2" style={{ gridTemplateColumns: '1fr 1fr' }}>
            <label>Budget from <span className="hint">lakh ₹</span>
              <input inputMode="numeric" value={sp.get('min') || ''} onChange={(e) => set('min', e.target.value.replace(/[^\d.]/g, ''))} />
            </label>
            <label>to <span className="hint">lakh ₹</span>
              <input inputMode="numeric" value={sp.get('max') || ''} onChange={(e) => set('max', e.target.value.replace(/[^\d.]/g, ''))} />
            </label>
          </div>
          <div className="grid2" style={{ gridTemplateColumns: '1fr 1fr' }}>
            <label>Size from <span className="hint">sq. yards</span>
              <input inputMode="numeric" value={sp.get('minsz') || ''} onChange={(e) => set('minsz', e.target.value.replace(/[^\d.]/g, ''))} />
            </label>
            <label>to <span className="hint">sq. yards</span>
              <input inputMode="numeric" value={sp.get('maxsz') || ''} onChange={(e) => set('maxsz', e.target.value.replace(/[^\d.]/g, ''))} />
            </label>
          </div>
          <small>1 acre is 4,840 sq. yards; 1 cent is 48.4 sq. yards.</small>
          <label>Approval
            <select value={f.approval} onChange={(e) => set('approval', e.target.value)}>
              <option value="">Any</option>
              {APPROVALS.map((a) => <option key={a}>{a}</option>)}
            </select>
          </label>
          <label className="check"><input type="checkbox" checked={!!f.verifiedOnly} onChange={(e) => set('verified', e.target.checked ? '1' : '')} /> Verified listings only</label>
          <button className="linkbtn" type="button" onClick={() => setSp(new URLSearchParams(), { replace: true })}>Clear filters</button>
        </aside>}
        </div>

        <section className="stack" aria-live="polite">
          <div className="spread">
            <h1 style={{ fontSize: '1.6rem' }}>{loading ? 'Searching…' : `${items.length} ${items.length === 1 ? 'property' : 'properties'}`}</h1>
            <div className="row">
              <select aria-label="Sort" value={f.sort} onChange={(e) => set('sort', e.target.value === 'newest' ? '' : e.target.value)} style={{ width: 'auto' }}>
                <option value="newest">Featured and newest</option>
                <option value="price_asc">Price, low to high</option>
                <option value="price_desc">Price, high to low</option>
              </select>
              <div className="seg" role="group" aria-label="View">
                <button type="button" aria-pressed={view === 'list'} onClick={() => setView('list')}>List</button>
                <button type="button" aria-pressed={view === 'map'} onClick={() => setView('map')}>Map</button>
              </div>
            </div>
          </div>
          {error && <Notice kind="error">{error}</Notice>}
          {view === 'map' && <ResultsMap items={items} />}
          {view === 'map' && <small>Only listings with a map pin appear on the map. Select a pin to open the listing.</small>}
          {view === 'list' && items.map((p) => <PropertyCard key={p.id} p={p} />)}
          {!loading && !error && items.length === 0 && (
            <Empty title="No land matches these filters">
              <p>Try a wider budget, another district, or clear the filters.</p>
            </Empty>
          )}
        </section>
      </div>
    </div>
  );
}
