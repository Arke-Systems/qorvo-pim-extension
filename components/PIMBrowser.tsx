'use client';
import { useEffect, useMemo, useState } from 'react';
import { debounce } from '../lib/debounce';
import type { ProductSummary } from '../utils/types';

interface Props {
  multi?: boolean;
  displayFields?: string[];
  defaultFilters?: Record<string,string>;
  initialValue: ProductSummary | ProductSummary[] | null;
  onChange: (value: ProductSummary | ProductSummary[] | null) => void;
}

const PAGE_SIZE = 20;

export default function PIMBrowser({ multi=false, displayFields=['category'], defaultFilters, initialValue, onChange }: Props){
  const [q,setQ] = useState('');
  const [page,setPage] = useState(1);
  const [loading,setLoading] = useState(false);
  const [error,setError] = useState<string|null>(null);
  const [items,setItems] = useState<ProductSummary[]>([]);
  const [total,setTotal] = useState(0);
  const [selection,setSelection] = useState<ProductSummary | ProductSummary[] | null>(initialValue);

  useEffect(()=>{ setSelection(initialValue); },[initialValue]);

  const doFetch = async (signal?: AbortSignal) => {
    setLoading(true); setError(null);
    try {
      const params = new URLSearchParams({ q, limit: String(PAGE_SIZE), page: String(page), ...(defaultFilters||{}) });
      const res = await fetch(`/api/pim/search?${params.toString()}`, { signal });
      let data: any;
      if(!res.ok){
        try { data = await res.json(); } catch { /* ignore */ }
        const msg = data?.error || `PIM proxy error: ${res.status}`;
        throw new Error(msg);
      }
      data = await res.json();
      setItems(data.items || []);
      setTotal(data.total || 0);
    } catch(e:any){ if(e.name !== 'AbortError') setError(e.message || 'Unknown error'); }
    finally { setLoading(false); }
  };

  useEffect(()=>{
    const ctrl = new AbortController();
    doFetch(ctrl.signal);
    return () => ctrl.abort();
  },[q,page,JSON.stringify(defaultFilters)]);

  const debounced = useMemo(()=>debounce((val:string)=> setQ(val),250),[]);

  const toggleSelect = (p: ProductSummary) => {
    if(multi){
      const list = Array.isArray(selection)? [...selection]:[];
      const idx = list.findIndex(x=>x.id===p.id);
      if(idx>=0) list.splice(idx,1); else list.push(p);
      setSelection(list); onChange(list);
    } else { setSelection(p); onChange(p); }
  };

  const isSelected = (id:string) => Array.isArray(selection)? selection.some(x=>x.id===id) : (selection as ProductSummary | null)?.id === id;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div style={{ border: '1px solid #e5e7eb', borderRadius: 8, padding: 12, fontFamily: 'system-ui, Arial' }}>
      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        <input placeholder='Search products' onChange={e=>debounced(e.target.value)} style={{ flex:1, padding:8, border:'1px solid #d1d5db', borderRadius:6 }} />
        <button onClick={()=>setPage(1)} style={{ padding:'8px 12px', border:'1px solid #d1d5db', borderRadius:6, background:'#f9fafb', cursor:'pointer' }}>Search</button>
        <button
          type='button'
          onClick={()=>{ setSelection(null); onChange(null); }}
          style={{ padding:'8px 12px', border:'1px solid #d1d5db', borderRadius:6, background:'#fff', cursor:'pointer' }}
          disabled={selection==null}
        >Clear</button>
      </div>
      {error && <div style={{ color:'crimson', marginBottom:8 }}>Error: {error}</div>}
      {loading && <div style={{ fontSize:12, marginBottom:8 }}>Loading…</div>}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
        {items.map(p=> {
          const desc = (p.description || '').slice(0,80) + ((p.description||'').length>80 ? '…' : '');
          return (
            <div key={p.id} onClick={()=>toggleSelect(p)} style={{ display:'flex', gap:10, alignItems:'center', padding:10, border: isSelected(p.id)?'2px solid #2563eb':'1px solid #e5e7eb', borderRadius:8, cursor:'pointer', background: isSelected(p.id)?'#eff6ff':'white' }} title={p.name}>
              <img src={p.thumbnailUrl || '/icon.png'} alt={p.name} width={40} height={40} style={{ objectFit:'cover', borderRadius:6 }} />
              <div style={{ display:'flex', flexDirection:'column', lineHeight:1.2 }}>
                <strong>{p.name}</strong>
                <small>SKU: {p.sku}</small>
                {p.category && <small style={{ opacity:0.8 }}>{p.category}</small>}
                {desc && <small style={{ opacity:0.6 }}>{desc}</small>}
              </div>
            </div>
          );
        })}
      </div>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginTop:12 }}>
        <div>
          <button disabled={page<=1||loading} onClick={()=>setPage(p=>Math.max(1,p-1))} style={{ marginRight:8 }}>Prev</button>
          <button disabled={page>=totalPages||loading} onClick={()=>setPage(p=>Math.min(totalPages,p+1))}>Next</button>
        </div>
        <small>Page {page} / {totalPages} • {total} results</small>
      </div>
      <div style={{ marginTop:12, background:'#f3f4f6', padding:8, borderRadius:6 }}>
        <strong>Selected:</strong>
        <pre style={{ whiteSpace:'pre-wrap', margin:0, fontSize:12 }}>{JSON.stringify(selection,null,2)}</pre>
      </div>
    </div>
  );
}
