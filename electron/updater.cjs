// Auto-update via GitHub Releases (electron-updater).
// Repo de publicação é definido no package.json -> "build.publish".
// Em modo dev (ELECTRON_DEV_URL setada) o update é desativado.
const { app, dialog, BrowserWindow } = require("electron");
const log = require("electron-log");
const { autoUpdater } = require("electron-updater");

log.transports.file.level = "info";
autoUpdater.logger = log;
autoUpdater.autoDownload = true;
autoUpdater.autoInstallOnAppQuit = true;

function notify(message) {
  const win = BrowserWindow.getAllWindows()[0];
  if (win) win.webContents.send("kera:update:status", message);
  log.info("[updater]", message);
}

function setupAutoUpdater() {
  if (process.env.ELECTRON_DEV_URL) {
    log.info("[updater] dev mode, skipping");
    return;
  }
  if (!app.isPackaged) {
    log.info("[updater] not packaged, skipping");
    return;
  }

  autoUpdater.on("checking-for-update", () => notify({ state: "checking" }));
  autoUpdater.on("update-available", (info) =>
    notify({ state: "available", version: info.version })
  );
  autoUpdater.on("update-not-available", () => notify({ state: "up-to-date" }));
  autoUpdater.on("error", (err) =>
    notify({ state: "error", message: String(err?.message || err) })
  );
  autoUpdater.on("download-progress", (p) =>
    notify({ state: "downloading", percent: Math.round(p.percent) })
  );
  autoUpdater.on("update-downloaded", async (info) => {
    notify({ state: "downloaded", version: info.version });
    const { response } = await dialog.showMessageBox({
      type: "info",
      buttons: ["Reiniciar agora", "Depois"],
      defaultId: 0,
      cancelId: 1,
      title: "Atualização pronta",
      message: `Kera Desktop ${info.version} foi baixada.`,
      detail: "Reiniciar agora pra aplicar a atualização?",
    });
    if (response === 0) autoUpdater.quitAndInstall();
  });

  // Checa imediatamente e depois a cada 6h
  autoUpdater.checkForUpdatesAndNotify().catch((err) => log.error(err));
  setInterval(() => {
    autoUpdater.checkForUpdatesAndNotify().catch((err) => log.error(err));
  }, 6 * 60 * 60 * 1000);
}

module.exports = { setupAutoUpdater, autoUpdater };
