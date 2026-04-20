// Ponte segura renderer <-> main. Expõe APIs no `window.kera`.
// Tudo aqui é controlado: nada de require/fs no renderer puro.
const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("kera", {
  isDesktop: true,
  platform: () => ipcRenderer.invoke("kera:platform"),
  fs: {
    list: (dirPath) => ipcRenderer.invoke("kera:fs:list", dirPath),
    read: (filePath) => ipcRenderer.invoke("kera:fs:read", filePath),
    write: (filePath, content) => ipcRenderer.invoke("kera:fs:write", filePath, content),
    delete: (filePath) => ipcRenderer.invoke("kera:fs:delete", filePath),
    pickFolder: () => ipcRenderer.invoke("kera:fs:pickFolder"),
  },
  power: {
    shutdown: () => ipcRenderer.invoke("kera:power", "shutdown"),
    restart: () => ipcRenderer.invoke("kera:power", "restart"),
    hibernate: () => ipcRenderer.invoke("kera:power", "hibernate"),
    lock: () => ipcRenderer.invoke("kera:power", "lock"),
    cancel: () => ipcRenderer.invoke("kera:power", "cancel"),
  },
});
