import '@testing-library/jest-dom';

// Polyfill ResizeObserver for jsdom
global.ResizeObserver = class ResizeObserver {
  callback: ResizeObserverCallback;
  constructor(cb: ResizeObserverCallback){ this.callback = cb; }
  observe(){ /* no-op */ }
  unobserve(){ /* no-op */ }
  disconnect(){ /* no-op */ }
} as any;
