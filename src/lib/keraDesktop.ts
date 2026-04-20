// Tipos da API exposta pelo preload do Electron. Quando rodando no navegador
// (Kera web), `window.kera` é undefined; sempre cheque com `isKeraDesktop()`.
export type KeraFsEntry = {
  name: string;
  path: string;
  isDir: boolean;
  isFile: boolean;
};

export type KeraPlatformInfo = {
  platform: "win32" | "darwin" | "linux";
  arch: string;
  release: string;
  hostname: string;
  homedir: string;
  version: string;
};

export type KeraDesktopApi = {
  isDesktop: true;
  platform: () => Promise<KeraPlatformInfo>;
  allowlist: {
    get: () => Promise<string[]>;
    add: () => Promise<{ ok: boolean; cancelled?: boolean; list?: string[] }>;
    remove: (folder: string) => Promise<{ ok: boolean; list: string[] }>;
    check: (p: string) => Promise<boolean>;
  };
  fs: {
    list: (dirPath?: string) => Promise<KeraFsEntry[]>;
    read: (filePath: string) => Promise<string>;
    write: (filePath: string, content: string) => Promise<{ ok: boolean; cancelled?: boolean }>;
    delete: (filePath: string) => Promise<{ ok: boolean; cancelled?: boolean }>;
    pickFolder: () => Promise<string | null>;
  };
  power: {
    shutdown: () => Promise<{ ok: boolean; cancelled?: boolean; error?: string }>;
    restart: () => Promise<{ ok: boolean; cancelled?: boolean; error?: string }>;
    hibernate: () => Promise<{ ok: boolean; cancelled?: boolean; error?: string }>;
    lock: () => Promise<{ ok: boolean; cancelled?: boolean; error?: string }>;
    cancel: () => Promise<{ ok: boolean; error?: string }>;
  };
};

declare global {
  interface Window {
    kera?: KeraDesktopApi;
  }
}

export const isKeraDesktop = (): boolean => typeof window !== "undefined" && !!window.kera?.isDesktop;
export const getKera = (): KeraDesktopApi | null => (typeof window !== "undefined" ? window.kera ?? null : null);
