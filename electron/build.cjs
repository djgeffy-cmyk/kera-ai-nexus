// Build local opcional. No CI, prefira `npm run electron:release`
// que usa electron-builder direto e publica no GitHub Releases.
const { execSync } = require("child_process");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");

console.log("[1/2] Vite build...");
execSync("npm run build", {
  stdio: "inherit",
  cwd: ROOT,
  env: { ...process.env, ELECTRON_BUILD: "true" },
});

console.log("[2/2] electron-builder (AppImage)...");
execSync("npx electron-builder --linux AppImage --config electron-builder.config.cjs", {
  stdio: "inherit",
  cwd: ROOT,
  env: { ...process.env },
});

console.log("\n✅ Pronto! Veja em release-builds/*.AppImage");
