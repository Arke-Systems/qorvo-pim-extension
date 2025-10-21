'use client';
import PIMBrowser from '../../components/PIMBrowser';
import { useContentstackField } from '../../lib/useContentstackField';
import { useEffect, useState, useMemo } from 'react';
import type { ProductSummary } from '../../utils/types';

export default function ExtensionPage(){
  const { sdk, ready } = useContentstackField();
  const [initialValue, setInitialValue] = useState<ProductSummary | ProductSummary[] | null>(null);
  const [config, setConfig] = useState<any>({});

  // (Removed debug beacons and probes)

  useEffect(() => {
    // Collect config from SDK if available
    const sdkPaths: any[] = sdk ? [
      (sdk as any)?.field?.schema?.extensions?.field?.config,
      (sdk as any)?.field?.config,
      (sdk as any)?.config,
      (sdk as any)?.extension?.config,
    ].filter(Boolean) : [];
    // Local dev fallbacks: global injection, query params, NEXT_PUBLIC env vars
    let globalCfg: any = {};
    if (typeof window !== 'undefined') {
      globalCfg = (window as any).__PIM_EXTENSION_CONFIG__ || {};
    }
    let queryCfg: any = {};
    if (typeof window !== 'undefined') {
      const sp = new URLSearchParams(window.location.search);
      const get = (k: string) => sp.get(k) ?? undefined;
      queryCfg = {
        multi: get('multi'),
        multiple: get('multiple'),
        allowMultiple: get('allowMultiple'),
        multiSelect: get('multiSelect'),
        minHeight: get('minHeight') ? Number(get('minHeight')) : undefined
      };
      Object.keys(queryCfg).forEach(k => queryCfg[k] === undefined && delete queryCfg[k]);
    }
    const envCfg: any = {};
    if (process.env.NEXT_PUBLIC_PIM_EXTENSION_MULTI) envCfg.multi = process.env.NEXT_PUBLIC_PIM_EXTENSION_MULTI;
    if (process.env.NEXT_PUBLIC_PIM_EXTENSION_MIN_HEIGHT) envCfg.minHeight = Number(process.env.NEXT_PUBLIC_PIM_EXTENSION_MIN_HEIGHT);
    const merged = [ ...sdkPaths, globalCfg, queryCfg, envCfg ].reduce((acc,obj) => ({ ...acc, ...obj }), {});
    if (process.env.NEXT_PUBLIC_EXTENSION_DEBUG) {
      // eslint-disable-next-line no-console
      console.log('[PIM Extension] Resolved config (sdkReady=' + (!!sdk) + '):', merged);
      if (!sdk) console.log('[PIM Extension] SDK not ready; using fallback config only');
    }
    setConfig(merged);
    if (ready && sdk) {
      setInitialValue(sdk.field.getData() ?? null);
      sdk.field.setInvalid?.(false);
    }
  }, [ready, sdk]);
  // Accept several aliases for multi selection; treat any truthy value as enabling multi
  const multi = useMemo(() => {
    const raw = config.multi ?? config.multiple ?? config.allowMultiple ?? config.multiSelect;
    if (typeof raw === 'string') return ['true','1','yes','y','multi','multiple'].includes(raw.toLowerCase());
    return !!raw;
  }, [config]);

  // Only persist whitelisted keys to keep stored JSON lean & stable.
  const pickProduct = (p: any): ProductSummary => ({
    id: p.id,
    uuid: p.uuid || p.id,
    partNumber: p.partNumber,
    description: p.description,
    productType: p.productType ? { UUID: p.productType.UUID, Name: p.productType.Name } : null,
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
