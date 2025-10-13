declare module '@contentstack/ui-extensions-sdk' {
  // Minimal type surface used in the project.
  interface CSWindowAPI { updateHeight: (h: number) => void }
  interface CSFieldAPI {
    getData(): any;
    setData(v: any): void;
    setInvalid?(invalid: boolean): void;
    setDirty?(dirty: boolean): void;
    schema?: any;
  }
  export interface CSFieldSDK { window: CSWindowAPI; field: CSFieldAPI; config?: any }
  export function init(): Promise<CSFieldSDK>;
  // Some builds may default export an object containing init, others may export init directly.
  const _default: { init: typeof init } | ( ( ...args: any[] ) => Promise<CSFieldSDK> );
  export default _default;
}
