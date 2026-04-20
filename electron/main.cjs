// Janela principal da Kera Desktop. Sempre CommonJS (.cjs) porque o package.json
// declara "type":"module" e .js viraria ESM, quebrando __dirname.
const { app, BrowserWindow, ipcMain, dialog, shell } = require("electron");
const path = require("path");
const fs = require("fs/promises");
const { exec, execFile } = require("child_process");
const os = require("os");

let mainWindow = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 900,
    minHeight: 600,
    title: "Kera AI Desktop",
    backgroundColor: "#0a0a0a",
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false, // precisamos do preload com require
    },
  });

  // Em produção, carrega o build estático.
  // Em dev, se ELECTRON_DEV_URL estiver setado, carrega do servidor Vite.
  const devUrl = process.env.ELECTRON_DEV_URL;
  if (devUrl) {
    mainWindow.loadURL(devUrl);
  } else {
    mainWindow.loadFile(path.join(__dirname, "..", "dist", "index.html"));
  }

  // Abre links externos no navegador padrão, não numa nova janela Electron.
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });
}

app.whenReady().then(() => {
  createWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

// ============= INFO BÁSICA =============
ipcMain.handle("kera:platform", () => ({
  platform: process.platform, // 'win32' | 'darwin' | 'linux'
  arch: process.arch,
  release: os.release(),
  hostname: os.hostname(),
  homedir: os.homedir(),
  version: app.getVersion(),
}));

// ============= SISTEMA DE ARQUIVOS =============
// Todos os caminhos são absolutos. O renderer (Kera) decide qual mostrar.
ipcMain.handle("kera:fs:list", async (_e, dirPath) => {
  const target = path.resolve(dirPath || os.homedir());
  const entries = await fs.readdir(target, { withFileTypes: true });
  return entries.map((d) => ({
    name: d.name,
    path: path.join(target, d.name),
    isDir: d.isDirectory(),
    isFile: d.isFile(),
  }));
});

ipcMain.handle("kera:fs:read", async (_e, filePath) => {
  const data = await fs.readFile(path.resolve(filePath), "utf-8");
  return data;
});

ipcMain.handle("kera:fs:write", async (_e, filePath, content) => {
  await fs.writeFile(path.resolve(filePath), content, "utf-8");
  return { ok: true };
});

ipcMain.handle("kera:fs:delete", async (_e, filePath) => {
  // Confirmação OBRIGATÓRIA — Kera não deleta sem o humano olhar.
  const { response } = await dialog.showMessageBox(mainWindow, {
    type: "warning",
    buttons: ["Cancelar", "Deletar"],
    defaultId: 0,
    cancelId: 0,
    title: "Confirmar exclusão",
    message: `Deletar:\n${filePath}\n\nEsta ação não pode ser desfeita.`,
  });
  if (response !== 1) return { ok: false, cancelled: true };
  const target = path.resolve(filePath);
  const stat = await fs.stat(target);
  if (stat.isDirectory()) await fs.rm(target, { recursive: true });
  else await fs.unlink(target);
  return { ok: true };
});

ipcMain.handle("kera:fs:pickFolder", async () => {
  const r = await dialog.showOpenDialog(mainWindow, { properties: ["openDirectory"] });
  return r.canceled ? null : r.filePaths[0];
});

// ============= ENERGIA (desligar/reiniciar/hibernar/bloquear) =============
function powerCommand(action) {
  const p = process.platform;
  if (p === "win32") {
    if (action === "shutdown") return "shutdown /s /t 5";
    if (action === "restart") return "shutdown /r /t 5";
    if (action === "hibernate") return "shutdown /h";
    if (action === "lock") return "rundll32.exe user32.dll,LockWorkStation";
    if (action === "cancel") return "shutdown /a";
  }
  if (p === "darwin") {
    if (action === "shutdown") return "osascript -e 'tell app \"System Events\" to shut down'";
    if (action === "restart") return "osascript -e 'tell app \"System Events\" to restart'";
    if (action === "hibernate") return "pmset sleepnow";
    if (action === "lock") return "pmset displaysleepnow";
  }
  if (p === "linux") {
    if (action === "shutdown") return "shutdown -h +1";
    if (action === "restart") return "shutdown -r +1";
    if (action === "hibernate") return "systemctl hibernate";
    if (action === "lock") return "loginctl lock-session";
    if (action === "cancel") return "shutdown -c";
  }
  return null;
}

ipcMain.handle("kera:power", async (_e, action) => {
  const cmd = powerCommand(action);
  if (!cmd) return { ok: false, error: `Ação ${action} não suportada em ${process.platform}` };

  // Confirmação OBRIGATÓRIA — não desliga sem o humano clicar.
  if (action !== "cancel") {
    const labels = {
      shutdown: "DESLIGAR o computador",
      restart: "REINICIAR o computador",
      hibernate: "HIBERNAR o computador",
      lock: "BLOQUEAR a tela",
    };
    const { response } = await dialog.showMessageBox(mainWindow, {
      type: "warning",
      buttons: ["Cancelar", `Sim, ${labels[action] || action}`],
      defaultId: 0,
      cancelId: 0,
      title: "Confirmar ação de energia",
      message: `A Kera está pedindo para ${labels[action] || action}.\n\nDeseja prosseguir?`,
      detail: "Salve seus arquivos antes de continuar.",
    });
    if (response !== 1) return { ok: false, cancelled: true };
  }

  return new Promise((resolve) => {
    exec(cmd, (err) => {
      if (err) resolve({ ok: false, error: err.message });
      else resolve({ ok: true, command: cmd });
    });
  });
});
