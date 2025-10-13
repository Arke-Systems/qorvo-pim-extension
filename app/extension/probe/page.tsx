'use client';
// Minimal probe page to test message flow & sandbox without any SDK usage.
const BUILD_TS = new Date().toISOString();
try { window.parent?.postMessage({ type:'PIM_PROBE_EARLY', ts: Date.now(), buildTs: BUILD_TS }, '*'); } catch(_) {}

export default function Probe(){
  return (
    <div style={{fontFamily:'system-ui',padding:12}}>
      <h4>PIM Probe</h4>
      <p>Build: {BUILD_TS}</p>
      <p>This page sends a status beacon every second.</p>
    </div>
  );
}

// Periodic beacons (without React effects reliance)
let count = 0;
const id = setInterval(()=>{
  count++;
  try { window.parent?.postMessage({ type:'PIM_PROBE_STATUS', count, buildTs: BUILD_TS }, '*'); } catch(_) {}
  if(count>=12) clearInterval(id);
},1000);
