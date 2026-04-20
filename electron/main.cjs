// Janela principal da Kera Desktop. Sempre CommonJS (.cjs) porque o package.json
// declara "type":"module" e .js viraria ESM, quebrando __dirname.
const { app, BrowserWindow, ipcMain, dialog, shell } = require("electron");
const path = require("path");
const fs = require("fs/promises");
const fsSync = require("fs");
const { exec } = require("child_process");
const os = require("os");

let mainWindow = null;

// ============= ALLOW-LIST DE PASTAS AUTORIZADAS =============
// Persiste em userData/kera-allowlist.json. Qualquer fs:read/write/delete/list
// que caia fora dessas pastas é bloqueado, mesmo se a LLM tentar.
const ALLOWLIST_FILE = () => path.join(app.getPath("userData"), "kera-allowlist.json");

function loadAllowlist() {
  try {
    const raw = fsSync.readFileSync(ALLOWLIST_FILE(), "utf-8");
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr.filter((s) => typeof s === "string") : [];
  } catch {
    return [];
  }
}

function saveAllowlist(list) {
  fsSync.mkdirSync(path.dirname(ALLOWLIST_FILE()), { recursive: true });
  fsSync.writeFileSync(ALLOWLIST_FILE(), JSON.stringify(list, null, 2), "utf-8");
}

// Um path está autorizado se for igual ou descendente de alguma entrada da allow-list.
function isPathAllowed(targetPath) {
  const list = loadAllowlist();
  if (list.length === 0) return false;
  const resolved = path.resolve(targetPath);
  return list.some((allowed) => {
    const a = path.resolve(allowed);
    const rel = path.relative(a, resolved);
    return rel === "" || (!rel.startsWith("..") && !path.isAbsolute(rel));
  });
}

function assertAllowed(targetPath) {
  if (!isPathAllowed(targetPath)) {
    const err = new Error(
      `Acesso negado: "${targetPath}" não está em nenhuma pasta autorizada. Autorize em Kera Desktop > Pastas autorizadas.`
    );
    err.code = "EACCES_KERA";
    throw err;
  }
}

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
      sandbox: false,
    },
  });

  const devUrl = process.env.ELECTRON_DEV_URL;
  if (devUrl) {
    mainWindow.loadURL(devUrl);
  } else {
    mainWindow.loadFile(path.join(__dirname, "..", "dist", "index.html"));
  }

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
  platform: process.platform,
  arch: process.arch,
  release: os.release(),
  hostname: os.hostname(),
  homedir: os.homedir(),
  version: app.getVersion(),
}));

// ============= ALLOW-LIST =============
ipcMain.handle("kera:allowlist:get", () => loadAllowlist());

ipcMain.handle("kera:allowlist:add", async () => {
  const r = await dialog.showOpenDialog(mainWindow, {
    title: "Autorizar pasta para a Kera",
    properties: ["openDirectory"],
  });
  if (r.canceled || !r.filePaths[0]) return { ok: false, cancelled: true };

  const picked = path.resolve(r.filePaths[0]);

  const { response } = await dialog.showMessageBox(mainWindow, {
    type: "question",
    buttons: ["Cancelar", "Autorizar"],
    defaultId: 0,
    cancelId: 0,
    title: "Confirmar autorização",
    message: `Autorizar a Kera a ler, escrever e apagar em:\n\n${picked}\n\nTodas as ações de escrita/exclusão ainda pedirão confirmação individual.`,
  });
  if (response !== 1) return { ok: false, cancelled: true };

  const list = loadAllowlist();
  if (!list.includes(picked)) list.push(picked);
  saveAllowlist(list);
  return { ok: true, list };
});

ipcMain.handle("kera:allowlist:remove", (_e, folder) => {
  const target = path.resolve(folder);
  const list = loadAllowlist().filter((p) => path.resolve(p) !== target);
  saveAllowlist(list);
  return { ok: true, list };
});

ipcMain.handle("kera:allowlist:check", (_e, p) => isPathAllowed(p));

// ============= SISTEMA DE ARQUIVOS (restrito à allow-list) =============
ipcMain.handle("kera:fs:list", async (_e, dirPath) => {
  const target = path.resolve(dirPath || loadAllowlist()[0] || os.homedir());
  assertAllowed(target);
  const entries = await fs.readdir(target, { withFileTypes: true });
  return entries.map((d) => ({
    name: d.name,
    path: path.join(target, d.name),
    isDir: d.isDirectory(),
    isFile: d.isFile(),
  }));
});

ipcMain.handle("kera:fs:read", async (_e, filePath) => {
  const target = path.resolve(filePath);
  assertAllowed(target);
  return await fs.readFile(target, "utf-8");
});

ipcMain.handle("kera:fs:write", async (_e, filePath, content) => {
  const target = path.resolve(filePath);
  assertAllowed(target);

  const exists = fsSync.existsSync(target);
  const { response } = await dialog.showMessageBox(mainWindow, {
    type: "question",
    buttons: ["Cancelar", exists ? "Sobrescrever" : "Criar"],
    defaultId: 0,
    cancelId: 0,
    title: exists ? "Confirmar sobrescrita" : "Confirmar criação",
    message: `${exists ? "Sobrescrever" : "Criar"}:\n${target}`,
  });
  if (response !== 1) return { ok: false, cancelled: true };

  await fs.writeFile(target, content, "utf-8");
  return { ok: true };
});

ipcMain.handle("kera:fs:delete", async (_e, filePath) => {
  const target = path.resolve(filePath);
  assertAllowed(target);

  const { response } = await dialog.showMessageBox(mainWindow, {
    type: "warning",
    buttons: ["Cancelar", "Deletar"],
    defaultId: 0,
    cancelId: 0,
    title: "Confirmar exclusão",
    message: `Deletar:\n${target}\n\nEsta ação não pode ser desfeita.`,
  });
  if (response !== 1) return { ok: false, cancelled: true };

  const stat = await fs.stat(target);
  if (stat.isDirectory()) await fs.rm(target, { recursive: true });
  else await fs.unlink(target);
  return { ok: true };
});

// pickFolder abre o diálogo nativo. Não exige allow-list (é o próprio usuário escolhendo).
// Mas só retorna se a pasta já estiver autorizada — se não estiver, orienta a autorizar antes.
ipcMain.handle("kera:fs:pickFolder", async () => {
  const r = await dialog.showOpenDialog(mainWindow, { properties: ["openDirectory"] });
  if (r.canceled) return null;
  const picked = r.filePaths[0];
  if (!isPathAllowed(picked)) {
    await dialog.showMessageBox(mainWindow, {
      type: "info",
      title: "Pasta não autorizada",
      message: `"${picked}" não está autorizada.\n\nUse "Autorizar pasta" para liberar o acesso antes.`,
    });
    return null;
  }
  return picked;
});

// ============= ENERGIA =============
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
