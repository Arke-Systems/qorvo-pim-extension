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

  useEffect(()=>{
    let disposed = false;
    (async () => {
      try {
        const mod: any = await import('@contentstack/ui-extensions-sdk');
        const init: InitFn = (mod.init || mod.default || mod) as InitFn;
        const s = await init();
        if(disposed) return;
        setSdk(s); setReady(true);
        const computeMin = () => {
          const cfg = (s as any)?.field?.schema?.extensions?.field?.config || (s as any)?.config || {};
          const cfgMin = cfg.minHeight;
          const envMin = typeof process !== 'undefined' ? Number(process.env.NEXT_PUBLIC_IFRAME_MIN_HEIGHT) : undefined;
          const value = Number(cfgMin) || envMin || 800;
          return isFinite(value) ? value : 800;
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
        // Staggered retries to fight host layout transitions / accordion animations
        [50, 100, 300, 600, 1000, 1500, 2500].forEach(ms => setTimeout(()=>{applyStructuralMin(); resize();}, ms));
        // Heartbeat for late content (images, fonts) - every 1s for 10s
        let ticks = 0;
        const heartbeat = setInterval(()=>{
          if(++ticks > 10) { clearInterval(heartbeat); return; }
          applyStructuralMin();
          resize();
        },1000);
        // Expose manual trigger for debugging in console: window.__csForceResize__()
        (window as any).__csForceResize__ = () => { applyStructuralMin(); resize(); };
      } catch (e) {
        // eslint-disable-next-line no-console
        console.error('Failed to initialize Contentstack UI Extension SDK', e);
      }
    })();
    return () => { disposed = true; };
  },[]);

  return { sdk, ready } as const;
}
