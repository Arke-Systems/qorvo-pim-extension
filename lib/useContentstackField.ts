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
  const [error, setError] = useState<unknown>(null);

  useEffect(()=>{
    let disposed = false;
    (async () => {
      try {
  const t0 = performance.now();
  console.log('[PIM HOOK] init start');
  const mod: any = await import('@contentstack/ui-extensions-sdk').catch(e => { console.error('[PIM HOOK] dynamic import failed', e); throw e; });
  console.log('[PIM HOOK] module imported', { keys: Object.keys(mod), dt: (performance.now()-t0).toFixed(1)+'ms' });
        let init: any = null;
        if (typeof mod.init === 'function') init = mod.init;
        else if (mod.default && typeof mod.default.init === 'function') init = mod.default.init;
        else if (typeof mod === 'function') init = mod; // fallback (older pattern)
        if (!init) {
          console.error('[PIM EXT] Contentstack SDK init function not found. Module keys:', Object.keys(mod));
          return;
        }
        const t1 = performance.now();
        let s: any;
        try {
          s = await init();
        } catch(e:any){
          console.error('[PIM HOOK] init() threw', e);
          throw e;
        }
        console.log('[PIM HOOK] init resolved', { dt: (performance.now()-t1).toFixed(1)+'ms', hasField: !!s?.field, hasWindow: !!s?.window });
        if(disposed) return;
        setSdk(s); setReady(true);
        const computeMin = () => {
          const cfg = (s as any)?.field?.schema?.extensions?.field?.config || (s as any)?.config || {};
          const cfgMin = cfg.minHeight;
          const envMin = typeof process !== 'undefined' ? Number(process.env.NEXT_PUBLIC_IFRAME_MIN_HEIGHT) : undefined;
          const value = Number(cfgMin) || envMin || 800;
          const finalVal = isFinite(value) ? value : 800;
          // Debug one-time log
          if (!(window as any).__loggedMinHeight) {
            (window as any).__loggedMinHeight = true;
            console.debug('[PIM EXT] minHeight computed:', { cfgMin, envMin, finalVal });
          }
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
        // Spacer + escalation to fight host not honoring initial updateHeight
        const spacerId = '__pimSpacer';
        let spacer = document.getElementById(spacerId);
        if(!spacer) {
          spacer = document.createElement('div');
          spacer.id = spacerId;
          spacer.style.cssText = 'width:100%;height:0;pointer-events:none;opacity:0;';
          document.body.appendChild(spacer);
        }
        // Debug overlay
        const overlay = document.createElement('div');
        overlay.style.cssText = 'position:fixed;bottom:4px;right:4px;background:#1e293b;color:#fff;font:11px/1.2 system-ui;padding:4px 6px;border-radius:4px;z-index:2147483647;opacity:.85';
        overlay.textContent = 'height:init';
        document.body.appendChild(overlay);
        let attempt = 0;
        const escalate = () => {
          attempt++;
          const minH = computeMin();
          const target = minH + 200; // overshoot
          spacer!.style.height = target + 'px';
          const bodyH = document.body.scrollHeight;
          s.window.updateHeight(Math.max(target, bodyH));
          overlay.textContent = `escalate#${attempt} body:${bodyH} target:${target}`;
          if (attempt < 20) setTimeout(escalate, 300);
          else overlay.textContent += ' (done)';
        };
        setTimeout(escalate, 120); // start escalation after early resizes
      } catch (e) {
        setError(e);
        try {
          (window as any).__PIM_ENV_DIAG = {
            at: new Date().toISOString(),
            error: String(e),
            stack: (e as any)?.stack,
            location: window.location.href,
            referrer: document.referrer,
            parentOrigin: window.parent === window ? null : document.referrer?.split('/').slice(0,3).join('/') || 'unknown',
            userAgent: navigator.userAgent,
            iframeSandbox: (window.frameElement && window.frameElement.getAttribute('sandbox')) || null,
            windowName: window.name
          };
        } catch(_){}
        console.error('Failed to initialize Contentstack UI Extension SDK', e);
      }
    })();
    return () => { disposed = true; };
  },[]);

  return { sdk, ready, error } as const;
}
