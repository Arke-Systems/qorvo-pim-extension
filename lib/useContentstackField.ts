'use client';
import { useEffect, useState } from 'react';
// Minimal Contentstack UI Extension SDK type surface used by this project.
interface CSWindowAPI { updateHeight: (h: number) => void }
interface CSFieldAPI {
  getData: () => any;
  setData: (v: any) => void;
  setInvalid?: (invalid: boolean) => void;
  setDirty?: (dirty: boolean) => void;
  schema?: any;
}
interface CSFieldSDK { window: CSWindowAPI; field: CSFieldAPI; config?: any }

type InitFn = () => Promise<CSFieldSDK>;

export function useContentstackField(){
  const [sdk, setSdk] = useState<CSFieldSDK | null>(null);
  const [ready, setReady] = useState(false);
  // No error exposure in lean production version

  useEffect(()=>{
    let disposed = false;
    (async () => {
      try {
        const mod: any = await import('@contentstack/ui-extensions-sdk');
        let init: any = null;
        if (typeof mod.init === 'function') init = mod.init;
        else if (mod.default && typeof mod.default.init === 'function') init = mod.default.init;
        else if (typeof mod === 'function') init = mod; // fallback (older pattern)
        if (!init) {
          console.error('[PIM EXT] Contentstack SDK init function not found. Module keys:', Object.keys(mod));
          return;
        }
        const s = await init();
        if(disposed) return;
        setSdk(s); setReady(true);
        const computeMin = () => {
          const cfg = (s as any)?.field?.schema?.extensions?.field?.config || (s as any)?.config || {};
          const cfgMin = cfg.minHeight;
          const envMin = typeof process !== 'undefined' ? Number(process.env.NEXT_PUBLIC_IFRAME_MIN_HEIGHT) : undefined;
          const value = Number(cfgMin) || envMin || 800;
          const finalVal = isFinite(value) ? value : 800;
          return finalVal;
        };
        const resize = () => {
          const minH = computeMin();
          const h = Math.max(minH, document.body.scrollHeight);
          s.window.updateHeight(h);
        };
        const obs = new ResizeObserver(resize);
        obs.observe(document.body);
        const applyStructuralMin = () => {
          const minH = computeMin();
          document.documentElement.style.minHeight = minH + 'px';
          document.body.style.minHeight = minH + 'px';
        };
        applyStructuralMin();
        resize();
      } catch (e) {
        console.error('Failed to initialize Contentstack UI Extension SDK', e);
      }
    })();
    return () => { disposed = true; };
  },[]);

  return { sdk, ready } as const;
}
