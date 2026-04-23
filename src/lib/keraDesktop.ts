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

export type KeraSystemStatus = {
  platform: string;
  hostname: string;
  uptimeSec: number;
  cpuModel: string;
  cpuCount: number;
  loadAvg: number[];
  memTotalBytes: number;
  memFreeBytes: number;
  memUsedPct: number;
  homeDiskRaw: string | null;
  nodeVersion: string;
  electronVersion: string;
};

export type KeraExecResult = {
  ok: boolean;
  cancelled?: boolean;
  error?: string;
  code?: number | string;
  stdout?: string;
  stderr?: string;
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
  clipboard: {
    read: () => Promise<string>;
    write: (text: string) => Promise<{ ok: boolean }>;
  };
  screenshot: () => Promise<{ ok: boolean; cancelled?: boolean; dataUrl?: string; error?: string }>;
  system: {
    status: () => Promise<KeraSystemStatus>;
  };
  open: {
    path: (target: string) => Promise<{ ok: boolean; cancelled?: boolean; error?: string }>;
    app: (appName: string, args?: string[]) => Promise<{ ok: boolean; cancelled?: boolean; error?: string }>;
  };
  exec: (command: string) => Promise<KeraExecResult>;
  install: {
    apt: (pkg: string) => Promise<{ ok: boolean; cancelled?: boolean; error?: string; note?: string }>;
    flatpak: (appId: string) => Promise<{ ok: boolean; cancelled?: boolean; error?: string; stdout?: string; stderr?: string }>;
    searchFlatpak: (query: string) => Promise<{ ok: boolean; error?: string; stdout?: string; stderr?: string }>;
  };
  power: {
    shutdown: () => Promise<{ ok: boolean; cancelled?: boolean; error?: string }>;
    restart: () => Promise<{ ok: boolean; cancelled?: boolean; error?: string }>;
    hibernate: () => Promise<{ ok: boolean; cancelled?: boolean; error?: string }>;
    lock: () => Promise<{ ok: boolean; cancelled?: boolean; error?: string }>;
    cancel: () => Promise<{ ok: boolean; error?: string }>;
  };
  update: {
    check: () => Promise<{ ok: boolean; skipped?: boolean; reason?: string; updateInfo?: { version?: string } | null; error?: string }>;
    install: () => Promise<{ ok: boolean }>;
    onStatus: (cb: (payload: { state: string; version?: string; percent?: number; message?: string }) => void) => () => void;
  };
  videos: {
    status: () => Promise<{ cached: string[]; missing: string[]; total: number; map: Record<string, string>; dir: string }>;
    download: () => Promise<{ ok: boolean; errors: { name: string; error: string }[]; map: Record<string, string> }>;
    clear: () => Promise<{ ok: boolean }>;
    onProgress: (cb: (p: { name: string; received: number; total: number }) => void) => () => void;
  };
  organizer: {
    defaults: () => Promise<{ label: string; path: string }[]>;
    authorizeAll: () => Promise<{
      ok: boolean;
      cancelled?: boolean;
      alreadyAuthorized?: boolean;
      added?: { label: string; path: string }[];
      list?: string[];
      error?: string;
    }>;
    scan: (folderPath: string) => Promise<{
      folder: string;
      files: { name: string; path: string; ext: string; sizeBytes: number; modifiedAt: string }[];
    }>;
    apply: (payload: { rootFolder: string; plan: { from: string; folder: string }[] }) => Promise<{
      ok: boolean;
      cancelled?: boolean;
      moved?: number;
      createdFolders?: string[];
      errors?: { from: string; error: string }[];
      error?: string;
    }>;
    history: () => Promise<{ at: number; root: string; moves: { from: string; to: string }[] }[]>;
    undo: () => Promise<{ ok: boolean; cancelled?: boolean; restored?: number; errors?: { to: string; error: string }[]; error?: string }>;
    diagnose: () => Promise<{
      ok: boolean;
      total: number;
      okCount: number;
      results: {
        folder: string;
        exists: boolean;
        canList: boolean;
        canWrite: boolean;
        canRead: boolean;
        canMove: boolean;
        canDelete: boolean;
        fileCount: number | null;
        error: string | null;
      }[];
    }>;
  };
  mascot: {
    show: () => Promise<{ ok: boolean }>;
    hide: () => Promise<{ ok: boolean }>;
    status: () => Promise<{ visible: boolean }>;
    wake: () => Promise<{ ok: boolean }>;
    videoUrl: () => Promise<string | null>;
    onHotword: (cb: (payload: { source: string }) => void) => () => void;
  };
};

declare global {
  interface Window {
    kera?: KeraDesktopApi;
  }
}

export const isKeraDesktop = (): boolean => typeof window !== "undefined" && !!window.kera?.isDesktop;
export const getKera = (): KeraDesktopApi | null => (typeof window !== "undefined" ? window.kera ?? null : null);
