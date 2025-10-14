'use client';
// Alternate route for debugging embed issues separate from /extension
try { window.parent?.postMessage({ type:'PIM_PIM_EARLY', ts: Date.now() }, '*'); } catch(_) {}
import PIMBrowser from '../../components/PIMBrowser';
import { useContentstackField } from '../../lib/useContentstackField';
import { useEffect, useState } from 'react';
import type { ProductSummary } from '../../utils/types';

const BUILD_TS = new Date().toISOString();

import React from 'react';
class Boundary extends React.Component<{children:any},{err:any}> {
  constructor(p:any){ super(p); this.state={err:null}; }
  static getDerivedStateFromError(err:any){ return {err}; }
  componentDidCatch(err:any,info:any){ console.error('[PIM /pim] boundary caught', err, info); }
  render(){
    if(this.state.err){ return <div style={{padding:16,fontFamily:'system-ui',color:'#b00'}}>
      <h3>PIM Error</h3>
      <pre style={{whiteSpace:'pre-wrap'}}>{String(this.state.err?.stack||this.state.err)}</pre>
    </div>; }
    return this.props.children;
  }
}

export default function PIMAlt(){
  console.log('[PIM /pim] page module eval', { buildTs: BUILD_TS });
  const { sdk, ready } = useContentstackField();
  const [initialValue, setInitialValue] = useState<ProductSummary | ProductSummary[] | null>(null);
  const [config, setConfig] = useState<any>({});
  useEffect(()=>{ (window as any).__PIM_PIM_INFO = { buildTs: BUILD_TS }; },[]);
  useEffect(()=>{
    if(!ready || !sdk) return;
    try {
      setInitialValue(sdk.field.getData() ?? null);
      const cfg = (sdk as any)?.field?.schema?.extensions?.field?.config || (sdk as any)?.config || {};
      setConfig(cfg);
      console.log('[PIM /pim] sdk ready', { cfg, data: sdk.field.getData() });
    } catch(e){ console.error('[PIM /pim] post-ready error', e); }
  },[ready,sdk]);
  const multi = !!config.multi;
  const pickProduct = (p: any): ProductSummary => ({ id:p.id, sku:p.sku, name:p.name, thumbnailUrl:p.thumbnailUrl });
  const handleChange = (value: ProductSummary | ProductSummary[] | null) => {
    if(!sdk) return;
    let toStore:any = null;
    if(Array.isArray(value)) toStore = value.map(pickProduct); else if(value) toStore = pickProduct(value);
    try {
      const fieldType = (sdk as any)?.field?.schema?.data_type;
      if(fieldType && fieldType.toLowerCase()==='json') sdk.field.setData(toStore); else sdk.field.setData(toStore==null?null:JSON.stringify(toStore));
      (sdk as any).field?.setDirty?.(true);
    } catch(e){ console.error('[PIM /pim] setData failed', e); }
  };
  const minHeight = Number(config.minHeight)||800;
  return <Boundary>
    <div style={{padding:16,minHeight}}>
      <h3>/pim Alt Picker {multi?'(Multiple)':'(Single)'} - {BUILD_TS}</h3>
      <PIMBrowser multi={multi} displayFields={config?.displayFields} defaultFilters={config?.filters} initialValue={initialValue} onChange={handleChange} />
    </div>
  </Boundary>;
}