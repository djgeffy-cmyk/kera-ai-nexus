// Ponte segura renderer <-> main. Expõe APIs no `window.kera`.
const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("kera", {
  isDesktop: true,
  platform: () => ipcRenderer.invoke("kera:platform"),
  allowlist: {
    get: () => ipcRenderer.invoke("kera:allowlist:get"),
    add: () => ipcRenderer.invoke("kera:allowlist:add"),
    remove: (folder) => ipcRenderer.invoke("kera:allowlist:remove", folder),
    check: (p) => ipcRenderer.invoke("kera:allowlist:check", p),
  },
  fs: {
    list: (dirPath) => ipcRenderer.invoke("kera:fs:list", dirPath),
    read: (filePath) => ipcRenderer.invoke("kera:fs:read", filePath),
    write: (filePath, content) => ipcRenderer.invoke("kera:fs:write", filePath, content),
    delete: (filePath) => ipcRenderer.invoke("kera:fs:delete", filePath),
    pickFolder: () => ipcRenderer.invoke("kera:fs:pickFolder"),
  },
  clipboard: {
    read: () => ipcRenderer.invoke("kera:clipboard:read"),
    write: (text) => ipcRenderer.invoke("kera:clipboard:write", text),
  },
  screenshot: () => ipcRenderer.invoke("kera:screenshot"),
  system: {
    status: () => ipcRenderer.invoke("kera:system:status"),
  },
  open: {
    path: (target) => ipcRenderer.invoke("kera:open:path", target),
    app: (appName, args) => ipcRenderer.invoke("kera:open:app", appName, args),
  },
  exec: (command) => ipcRenderer.invoke("kera:exec", command),
  install: {
    apt: (pkg) => ipcRenderer.invoke("kera:install:apt", pkg),
    flatpak: (appId) => ipcRenderer.invoke("kera:install:flatpak", appId),
    searchFlatpak: (query) => ipcRenderer.invoke("kera:search:flatpak", query),
  },
  power: {
    shutdown: () => ipcRenderer.invoke("kera:power", "shutdown"),
    restart: () => ipcRenderer.invoke("kera:power", "restart"),
    hibernate: () => ipcRenderer.invoke("kera:power", "hibernate"),
    lock: () => ipcRenderer.invoke("kera:power", "lock"),
    cancel: () => ipcRenderer.invoke("kera:power", "cancel"),
  },
  update: {
    check: () => ipcRenderer.invoke("kera:update:check"),
    install: () => ipcRenderer.invoke("kera:update:install"),
    onStatus: (cb) => {
      const handler = (_e, payload) => cb(payload);
      ipcRenderer.on("kera:update:status", handler);
      return () => ipcRenderer.removeListener("kera:update:status", handler);
    },
  },
  videos: {
    status: () => ipcRenderer.invoke("kera:videos:status"),
    download: () => ipcRenderer.invoke("kera:videos:download"),
    clear: () => ipcRenderer.invoke("kera:videos:clear"),
    onProgress: (cb) => {
      const handler = (_e, payload) => cb(payload);
      ipcRenderer.on("kera:videos:progress", handler);
      return () => ipcRenderer.removeListener("kera:videos:progress", handler);
    },
  },
  organizer: {
    defaults: () => ipcRenderer.invoke("kera:organizer:defaults"),
    scan: (folderPath) => ipcRenderer.invoke("kera:organizer:scan", folderPath),
    apply: (payload) => ipcRenderer.invoke("kera:organizer:apply", payload),
    history: () => ipcRenderer.invoke("kera:organizer:history"),
    undo: () => ipcRenderer.invoke("kera:organizer:undo"),
  },
  mascot: {
    show: () => ipcRenderer.invoke("kera:mascot:show"),
    hide: () => ipcRenderer.invoke("kera:mascot:hide"),
    status: () => ipcRenderer.invoke("kera:mascot:status"),
    wake: () => ipcRenderer.invoke("kera:mascot:wake"),
    videoUrl: () => ipcRenderer.invoke("kera:mascot:videoUrl"),
    onHotword: (cb) => {
      const handler = (_e, payload) => cb(payload);
      ipcRenderer.on("kera:hotword", handler);
      return () => ipcRenderer.removeListener("kera:hotword", handler);
    },
  },
});
