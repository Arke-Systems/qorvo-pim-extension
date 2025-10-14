"use client";
import { useState } from 'react';
import PIMBrowser from './PIMBrowser';
import type { ProductSummary } from '../utils/types';

interface Props {
  error: unknown;
}

export default function StandaloneFallback({ error }: Props){
  const [selection, setSelection] = useState<ProductSummary | ProductSummary[] | null>(null);
  const multi = true; // enable multi-select in fallback for flexibility

  const handleChange = (val: any) => setSelection(val);

  const serialize = () => {
    try { return JSON.stringify(selection, null, 2); } catch { return '[]'; }
  };

  const copy = () => {
    try { navigator.clipboard.writeText(serialize()); } catch(_){}
  };

  return (
    <div style={{ fontFamily:'system-ui', padding:16, minHeight:800 }}>
      <div style={{ background:'#b91c1c', color:'#fff', padding:'8px 12px', borderRadius:4, marginBottom:12 }}>
        <strong>Contentstack context unavailable.</strong> Operating in standalone fallback mode. You can still search and build a selection; copy the JSON below and manually paste it into the field once the platform issue is resolved.
      </div>
      <PIMBrowser
        multi={multi}
        initialValue={null}
        onChange={handleChange}
      />
      <div style={{marginTop:16}}>
        <h4 style={{margin:'12px 0 4px'}}>Current Selection JSON</h4>
        <textarea style={{width:'100%', height:160, fontFamily:'monospace', fontSize:12}} readOnly value={serialize()} />
        <button onClick={copy} style={{marginTop:8, padding:'6px 12px'}}>Copy JSON</button>
      </div>
      <details style={{marginTop:16}}>
        <summary style={{cursor:'pointer'}}>Diagnostics</summary>
        <pre style={{whiteSpace:'pre-wrap', fontSize:11, background:'#f1f5f9', padding:8}}>{JSON.stringify((window as any).__PIM_ENV_DIAG || {}, null, 2)}</pre>
        <h5>Error</h5>
        <pre style={{whiteSpace:'pre-wrap', fontSize:11}}>{String((error as any)?.stack || error)}</pre>
      </details>
    </div>
  );
}
