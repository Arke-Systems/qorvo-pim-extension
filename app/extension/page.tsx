'use client';
import PIMBrowser from '../../components/PIMBrowser';
import { useContentstackField } from '../../lib/useContentstackField';
import { useEffect, useState } from 'react';
import type { ProductSummary } from '../../utils/types';

export default function ExtensionPage(){
  const { sdk, ready } = useContentstackField();
  const [initialValue, setInitialValue] = useState<ProductSummary | ProductSummary[] | null>(null);
  const [config, setConfig] = useState<any>({});

  // Execution probe: parent frame can postMessage {type:'PIM_EXT_PING'} and we reply with PIM_EXT_PONG
  useEffect(()=>{
    const handler = (e: MessageEvent) => {
      if(e.data && e.data.type === 'PIM_EXT_PING') {
        window.parent?.postMessage({ type: 'PIM_EXT_PONG', ts: Date.now() }, '*');
      }
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  },[]);

  useEffect(() => {
    if(!ready || !sdk) return;
    setInitialValue(sdk.field.getData() ?? null);
    const cfg = (sdk as any)?.field?.schema?.extensions?.field?.config || (sdk as any)?.config || {};
    setConfig(cfg);
  // Height automatically managed in hook (min 800px).
  sdk.field.setInvalid?.(false);
  }, [ready, sdk]);

  const multi = !!config.multi;

  // Only persist whitelisted keys to keep stored JSON lean & stable.
  const pickProduct = (p: any): ProductSummary => ({
    id: p.id,
    sku: p.sku,
    name: p.name,
    thumbnailUrl: p.thumbnailUrl
  });

  const handleChange = (value: ProductSummary | ProductSummary[] | null) => {
    if(!sdk) return;
    let toStore: any = null;
    if(Array.isArray(value)) toStore = value.map(pickProduct);
    else if(value) toStore = pickProduct(value);
    // For JSON field types we can store objects directly; fallback to string for text fields.
    try {
      const fieldType = (sdk as any)?.field?.schema?.data_type; // e.g. 'json' or 'text'
      if(fieldType && fieldType.toLowerCase() === 'json') {
        sdk.field.setData(toStore);
      } else {
        sdk.field.setData(toStore == null ? null : JSON.stringify(toStore));
      }
      (sdk as any).field?.setDirty?.(true);
    } catch(e){
      // eslint-disable-next-line no-console
      console.error('Failed to set field data', e);
    }
  };

  const minHeight = Number(config.minHeight) || 800;
  return (
    <div className="cs-extension" style={{ padding: 16, minHeight }}>
      <h3 style={{ margin: '0 0 12px' }}>Qorvo PIM Browser {multi ? '(Multiple)' : '(Single)'}</h3>
      <PIMBrowser
        multi={multi}
        displayFields={config?.displayFields}
        defaultFilters={config?.filters}
        initialValue={initialValue}
        onChange={handleChange}
      />
    </div>
  );
}
