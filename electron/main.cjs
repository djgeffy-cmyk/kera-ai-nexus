// Janela principal da Kera Desktop. Sempre CommonJS (.cjs) porque o package.json
// declara "type":"module" e .js viraria ESM, quebrando __dirname.
const { app, BrowserWindow, ipcMain, dialog, shell, clipboard, desktopCapturer, screen, protocol, net, Tray, Menu, nativeImage } = require("electron");
const path = require("path");
const fs = require("fs/promises");
const fsSync = require("fs");
const { exec, spawn } = require("child_process");
const os = require("os");
const { setupAutoUpdater, autoUpdater } = require("./updater.cjs");

let mainWindow = null;
let mascotWindow = null;
let tray = null;

// ============= CACHE DE VÍDEOS (offline) =============
const VIDEO_FILES = [
  "kera-bg.mp4",
  "kera-dev-bg.mp4",
  "kera-sec-bg.mp4",
  "kera-juridica-bg.mp4",
  "kera-sentinela-bg.mp4",
  "kera-nutri-bg.mp4",
  "kera-gamer-bg.mp4",
  "kera-avatar.mp4",
  "kera-avatar-rain.mp4",
];
const VIDEO_REMOTE_BASE =
  "https://ytixqgkzqgeoxrbmjqbo.supabase.co/storage/v1/object/public/kera-videos";

const videosCacheDir = () => path.join(app.getPath("userData"), "videos");
const videoLocalPath = (name) => path.join(videosCacheDir(), name);

function ensureVideosDir() {
  fsSync.mkdirSync(videosCacheDir(), { recursive: true });
}

function cachedVideoMap() {
  ensureVideosDir();
  const map = {};
  for (const name of VIDEO_FILES) {
    const p = videoLocalPath(name);
    if (fsSync.existsSync(p) && fsSync.statSync(p).size > 0) {
      map[name] = `kera-video://local/${encodeURIComponent(name)}`;
    }
  }
  return map;
}

function downloadOne(name) {
  return new Promise((resolve, reject) => {
    const url = `${VIDEO_REMOTE_BASE}/${name}`;
    const dest = videoLocalPath(name);
    const tmp = `${dest}.part`;
    ensureVideosDir();
    const req = net.request(url);
    req.on("response", (res) => {
      if (res.statusCode !== 200) {
        reject(new Error(`HTTP ${res.statusCode} para ${name}`));
        return;
      }
      const total = Number(res.headers["content-length"] || 0);
      const file = fsSync.createWriteStream(tmp);
      let received = 0;
      res.on("data", (chunk) => {
        received += chunk.length;
        file.write(chunk);
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send("kera:videos:progress", { name, received, total });
        }
      });
      res.on("end", () => {
        file.end(() => {
          try { fsSync.renameSync(tmp, dest); resolve({ name, bytes: received }); }
          catch (e) { reject(e); }
        });
      });
      res.on("error", reject);
    });
    req.on("error", reject);
    req.end();
  });
}

// ============= ALLOW-LIST DE PASTAS =============
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
  if (devUrl) mainWindow.loadURL(devUrl);
  else mainWindow.loadFile(path.join(__dirname, "..", "dist", "index.html"));

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });
}

// ============= JANELA MASCOTE (Kera flutuante no desktop) =============
// Janela transparente, sem moldura, sempre no topo. Contém o vídeo da Kera
// rodando em loop. Anda sozinha pela tela. Hands-free: escuta hotword "kera".
function createMascotWindow() {
  if (mascotWindow && !mascotWindow.isDestroyed()) {
    mascotWindow.show();
    return mascotWindow;
  }
  const display = screen.getPrimaryDisplay();
  const W = 220;
  const H = 380;
  mascotWindow = new BrowserWindow({
    width: W,
    height: H,
    x: display.workArea.width - W - 40,
    y: display.workArea.height - H - 40,
    frame: false,
    transparent: true,
    resizable: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    hasShadow: false,
    focusable: true,
    backgroundColor: "#00000000",
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      backgroundThrottling: false,
    },
  });
  mascotWindow.setAlwaysOnTop(true, "screen-saver");
  mascotWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  mascotWindow.loadFile(path.join(__dirname, "mascot.html"));
  mascotWindow.on("closed", () => { mascotWindow = null; });
  return mascotWindow;
}

function destroyMascotWindow() {
  if (mascotWindow && !mascotWindow.isDestroyed()) mascotWindow.close();
  mascotWindow = null;
}

// ============= TRAY ICON =============
function createTray() {
  if (tray) return tray;
  // Ícone fallback: pega o icon.png do build se existir, senão um vazio.
  let iconPath = path.join(__dirname, "..", "build", "icon.png");
  if (!fsSync.existsSync(iconPath)) iconPath = path.join(__dirname, "..", "public", "icon-512.png");
  let icon;
  try {
    icon = nativeImage.createFromPath(iconPath).resize({ width: 22, height: 22 });
  } catch {
    icon = nativeImage.createEmpty();
  }
  tray = new Tray(icon);
  tray.setToolTip("Kera AI");
  const rebuildMenu = () => {
    const menu = Menu.buildFromTemplate([
      { label: "Abrir Kera", click: () => { if (mainWindow) { mainWindow.show(); mainWindow.focus(); } else { createWindow(); } } },
      { type: "separator" },
      {
        label: mascotWindow ? "Esconder mascote" : "Mostrar mascote",
        click: () => { mascotWindow ? destroyMascotWindow() : createMascotWindow(); rebuildMenu(); },
      },
      { type: "separator" },
      { label: "Sair", click: () => { app.quit(); } },
    ]);
    tray.setContextMenu(menu);
  };
  rebuildMenu();
  tray.on("click", () => { if (mainWindow) { mainWindow.show(); mainWindow.focus(); } });
  return tray;
}

// Registra o esquema ANTES de app.whenReady para ser tratado como standard.
protocol.registerSchemesAsPrivileged([
  { scheme: "kera-video", privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true, bypassCSP: true } },
]);

app.whenReady().then(() => {
  // kera-video://local/<filename> -> arquivo no userData/videos/
  protocol.registerFileProtocol("kera-video", (request, callback) => {
    try {
      const u = new URL(request.url);
      const name = decodeURIComponent(u.pathname.replace(/^\/+/, ""));
      callback({ path: videoLocalPath(name) });
    } catch (e) {
      callback({ error: -2 });
    }
  });

  createWindow();
  setupAutoUpdater();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

// ============= IPC CACHE DE VÍDEOS =============
ipcMain.handle("kera:videos:status", () => {
  const map = cachedVideoMap();
  return {
    cached: Object.keys(map),
    missing: VIDEO_FILES.filter((n) => !map[n]),
    total: VIDEO_FILES.length,
    map,
    dir: videosCacheDir(),
  };
});

ipcMain.handle("kera:videos:download", async () => {
  const missing = VIDEO_FILES.filter((n) => {
    const p = videoLocalPath(n);
    return !fsSync.existsSync(p) || fsSync.statSync(p).size === 0;
  });
  const errors = [];
  for (const name of missing) {
    try { await downloadOne(name); }
    catch (e) { errors.push({ name, error: String(e?.message || e) }); }
  }
  return { ok: errors.length === 0, errors, map: cachedVideoMap() };
});

ipcMain.handle("kera:videos:clear", async () => {
  for (const name of VIDEO_FILES) {
    const p = videoLocalPath(name);
    if (fsSync.existsSync(p)) { try { fsSync.unlinkSync(p); } catch {} }
  }
  return { ok: true };
});

// IPC: checagem manual de update + status
ipcMain.handle("kera:update:check", async () => {
  try {
    const r = await autoUpdater.checkForUpdates();
    return { ok: true, version: r?.updateInfo?.version || null };
  } catch (e) {
    return { ok: false, error: String(e?.message || e) };
  }
});

ipcMain.handle("kera:update:install", () => {
  autoUpdater.quitAndInstall();
  return { ok: true };
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
    defaultId: 0, cancelId: 0,
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

// ============= FILE SYSTEM =============
ipcMain.handle("kera:fs:list", async (_e, dirPath) => {
  const target = path.resolve(dirPath || loadAllowlist()[0] || os.homedir());
  assertAllowed(target);
  const entries = await fs.readdir(target, { withFileTypes: true });
  return entries.map((d) => ({
    name: d.name, path: path.join(target, d.name),
    isDir: d.isDirectory(), isFile: d.isFile(),
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
    defaultId: 0, cancelId: 0,
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
    defaultId: 0, cancelId: 0,
    title: "Confirmar exclusão",
    message: `Deletar:\n${target}\n\nEsta ação não pode ser desfeita.`,
  });
  if (response !== 1) return { ok: false, cancelled: true };
  const stat = await fs.stat(target);
  if (stat.isDirectory()) await fs.rm(target, { recursive: true });
  else await fs.unlink(target);
  return { ok: true };
});

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

// ============= CLIPBOARD =============
ipcMain.handle("kera:clipboard:read", () => clipboard.readText());
ipcMain.handle("kera:clipboard:write", (_e, text) => {
  clipboard.writeText(String(text ?? ""));
  return { ok: true };
});

// ============= SCREENSHOT =============
// Retorna dataURL PNG da tela. Sempre pede confirmação.
ipcMain.handle("kera:screenshot", async () => {
  const { response } = await dialog.showMessageBox(mainWindow, {
    type: "question",
    buttons: ["Cancelar", "Capturar"],
    defaultId: 0, cancelId: 0,
    title: "Capturar tela?",
    message: "A Kera vai capturar uma imagem da sua tela atual. Deseja prosseguir?",
  });
  if (response !== 1) return { ok: false, cancelled: true };

  const primary = screen.getPrimaryDisplay();
  const { width, height } = primary.size;
  const sources = await desktopCapturer.getSources({
    types: ["screen"],
    thumbnailSize: { width, height },
  });
  if (!sources.length) return { ok: false, error: "Nenhuma tela disponível" };
  return { ok: true, dataUrl: sources[0].thumbnail.toDataURL() };
});

// ============= SYSTEM STATUS =============
ipcMain.handle("kera:system:status", async () => {
  const totalMem = os.totalmem();
  const freeMem = os.freemem();
  const cpus = os.cpus();
  const load = os.loadavg();

  // Disco livre no home (Linux/macOS: df; Windows: wmic)
  const freeHome = await new Promise((resolve) => {
    const cmd = process.platform === "win32"
      ? `wmic logicaldisk get size,freespace,caption /format:csv`
      : `df -k "${os.homedir()}" | tail -1`;
    exec(cmd, (err, stdout) => {
      if (err) return resolve(null);
      resolve(stdout.trim());
    });
  });

  return {
    platform: process.platform,
    hostname: os.hostname(),
    uptimeSec: os.uptime(),
    cpuModel: cpus[0]?.model ?? "?",
    cpuCount: cpus.length,
    loadAvg: load,
    memTotalBytes: totalMem,
    memFreeBytes: freeMem,
    memUsedPct: Number(((1 - freeMem / totalMem) * 100).toFixed(1)),
    homeDiskRaw: freeHome,
    nodeVersion: process.versions.node,
    electronVersion: process.versions.electron,
  };
});

// ============= OPEN PROGRAMS / FILES / URLS =============
// Abre arquivo/pasta com o app padrão do SO. Requer allow-list se for path local.
ipcMain.handle("kera:open:path", async (_e, target) => {
  if (!target) return { ok: false, error: "Caminho vazio" };
  // Se não for URL http(s)/mailto, trata como path e valida allow-list.
  const isUrl = /^(https?:|mailto:|file:)/i.test(target);
  if (!isUrl) {
    const abs = path.resolve(target);
    assertAllowed(abs);
    const { response } = await dialog.showMessageBox(mainWindow, {
      type: "question",
      buttons: ["Cancelar", "Abrir"],
      defaultId: 1, cancelId: 0,
      title: "Abrir com app padrão?",
      message: `Abrir:\n${abs}`,
    });
    if (response !== 1) return { ok: false, cancelled: true };
    const err = await shell.openPath(abs);
    return err ? { ok: false, error: err } : { ok: true };
  }
  // URL: só confirma.
  const { response } = await dialog.showMessageBox(mainWindow, {
    type: "question",
    buttons: ["Cancelar", "Abrir no navegador"],
    defaultId: 1, cancelId: 0,
    title: "Abrir URL?",
    message: target,
  });
  if (response !== 1) return { ok: false, cancelled: true };
  await shell.openExternal(target);
  return { ok: true };
});

// Abre programa nomeado (ex: "firefox", "code", "gedit"). No Windows, usa `start`.
ipcMain.handle("kera:open:app", async (_e, appName, args) => {
  if (!appName || typeof appName !== "string") return { ok: false, error: "Nome inválido" };
  const safeArgs = Array.isArray(args) ? args.map(String) : [];

  const { response } = await dialog.showMessageBox(mainWindow, {
    type: "question",
    buttons: ["Cancelar", "Abrir"],
    defaultId: 1, cancelId: 0,
    title: "Abrir programa?",
    message: `Abrir: ${appName}${safeArgs.length ? " " + safeArgs.join(" ") : ""}`,
  });
  if (response !== 1) return { ok: false, cancelled: true };

  try {
    if (process.platform === "win32") {
      spawn("cmd.exe", ["/c", "start", "", appName, ...safeArgs], { detached: true, stdio: "ignore" }).unref();
    } else if (process.platform === "darwin") {
      spawn("open", ["-a", appName, ...safeArgs], { detached: true, stdio: "ignore" }).unref();
    } else {
      spawn(appName, safeArgs, { detached: true, stdio: "ignore" }).unref();
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e.message };
  }
});

// ============= TERMINAL (execução com confirmação) =============
// Perigoso — cada comando pede confirmação, tem timeout e truncagem de saída.
const EXEC_TIMEOUT_MS = 30_000;
const MAX_OUTPUT_CHARS = 20_000;

ipcMain.handle("kera:exec", async (_e, command) => {
  if (!command || typeof command !== "string") return { ok: false, error: "Comando vazio" };
  const trimmed = command.trim();

  const { response } = await dialog.showMessageBox(mainWindow, {
    type: "warning",
    buttons: ["Cancelar", "Executar"],
    defaultId: 0, cancelId: 0,
    title: "Executar comando no terminal?",
    message: `A Kera vai executar:\n\n${trimmed}\n\nPode alterar ou apagar arquivos do seu PC. Prossiga só se souber o que faz.`,
  });
  if (response !== 1) return { ok: false, cancelled: true };

  return new Promise((resolve) => {
    exec(trimmed, { timeout: EXEC_TIMEOUT_MS, maxBuffer: MAX_OUTPUT_CHARS * 4 }, (err, stdout, stderr) => {
      const out = String(stdout || "").slice(0, MAX_OUTPUT_CHARS);
      const errOut = String(stderr || "").slice(0, MAX_OUTPUT_CHARS);
      if (err && err.killed) resolve({ ok: false, error: "Timeout (30s)", stdout: out, stderr: errOut });
      else if (err) resolve({ ok: false, error: err.message, code: err.code, stdout: out, stderr: errOut });
      else resolve({ ok: true, stdout: out, stderr: errOut });
    });
  });
});

// ============= INSTALAR PROGRAMAS =============
// Regex de sanidade: só letras, números, ponto, hífen e sublinhado nos nomes.
const SAFE_PKG = /^[a-zA-Z0-9._+-]{1,80}$/;

// Detecta terminais disponíveis no Linux, em ordem de preferência.
function detectLinuxTerminal() {
  const candidates = [
    { bin: "gnome-terminal", args: (cmd) => ["--", "bash", "-lc", `${cmd}; echo; echo '[Pressione ENTER para fechar]'; read`] },
    { bin: "konsole",        args: (cmd) => ["-e", "bash", "-lc", `${cmd}; echo; echo '[Pressione ENTER para fechar]'; read`] },
    { bin: "xfce4-terminal", args: (cmd) => ["--hold", "-e", `bash -lc "${cmd.replace(/"/g, '\\"')}"`] },
    { bin: "xterm",          args: (cmd) => ["-hold", "-e", `bash -lc '${cmd.replace(/'/g, "'\\''")}'`] },
    { bin: "kitty",          args: (cmd) => ["bash", "-lc", `${cmd}; echo; read -p '[ENTER]'`] },
  ];
  for (const c of candidates) {
    try {
      const { execSync } = require("child_process");
      execSync(`command -v ${c.bin}`, { stdio: "ignore" });
      return c;
    } catch {}
  }
  return null;
}

// Instala via apt abrindo terminal visível (usuário digita a senha sudo lá).
ipcMain.handle("kera:install:apt", async (_e, packageName) => {
  if (process.platform !== "linux") return { ok: false, error: "apt só existe no Linux" };
  const pkg = String(packageName || "").trim();
  if (!SAFE_PKG.test(pkg)) return { ok: false, error: "Nome de pacote inválido" };

  const { response } = await dialog.showMessageBox(mainWindow, {
    type: "warning",
    buttons: ["Cancelar", "Abrir terminal e instalar"],
    defaultId: 0, cancelId: 0,
    title: "Instalar via apt?",
    message: `A Kera vai abrir um terminal rodando:\n\nsudo apt install -y ${pkg}\n\nVocê vai precisar digitar sua senha sudo NO TERMINAL que abrir.`,
  });
  if (response !== 1) return { ok: false, cancelled: true };

  const term = detectLinuxTerminal();
  if (!term) return { ok: false, error: "Nenhum terminal encontrado (gnome-terminal, konsole, xterm, etc)" };
  const cmd = `sudo apt update && sudo apt install -y ${pkg}`;
  try {
    spawn(term.bin, term.args(cmd), { detached: true, stdio: "ignore" }).unref();
    return { ok: true, note: `Terminal aberto (${term.bin}). Digite sua senha lá.` };
  } catch (e) {
    return { ok: false, error: e.message };
  }
});

// Instala via flatpak user-level (sem sudo).
ipcMain.handle("kera:install:flatpak", async (_e, appId) => {
  const id = String(appId || "").trim();
  if (!SAFE_PKG.test(id) && !/^[a-zA-Z0-9._-]+(\.[a-zA-Z0-9._-]+)+$/.test(id)) {
    return { ok: false, error: "App ID inválido (ex: com.spotify.Client)" };
  }

  const { response } = await dialog.showMessageBox(mainWindow, {
    type: "question",
    buttons: ["Cancelar", "Instalar"],
    defaultId: 1, cancelId: 0,
    title: "Instalar via Flatpak?",
    message: `A Kera vai instalar (user-level, sem senha):\n\nflatpak install --user -y flathub ${id}\n\nPode levar alguns minutos.`,
  });
  if (response !== 1) return { ok: false, cancelled: true };

  return new Promise((resolve) => {
    exec(`flatpak install --user -y flathub ${id}`, { timeout: 300_000, maxBuffer: MAX_OUTPUT_CHARS * 4 }, (err, stdout, stderr) => {
      const out = String(stdout || "").slice(0, MAX_OUTPUT_CHARS);
      const errOut = String(stderr || "").slice(0, MAX_OUTPUT_CHARS);
      if (err) resolve({ ok: false, error: err.message, stdout: out, stderr: errOut });
      else resolve({ ok: true, stdout: out, stderr: errOut });
    });
  });
});

// Busca Flatpak (sem senha, leitura).
ipcMain.handle("kera:search:flatpak", async (_e, query) => {
  const q = String(query || "").trim();
  if (!q || q.length > 80) return { ok: false, error: "Query inválida" };
  return new Promise((resolve) => {
    exec(`flatpak search --columns=application,name,description ${JSON.stringify(q)}`, { timeout: 20_000 }, (err, stdout, stderr) => {
      if (err) resolve({ ok: false, error: err.message, stderr: String(stderr || "") });
      else resolve({ ok: true, stdout: String(stdout || "").slice(0, MAX_OUTPUT_CHARS) });
    });
  });
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
      defaultId: 0, cancelId: 0,
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
