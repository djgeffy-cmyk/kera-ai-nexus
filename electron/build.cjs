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

const platform = process.env.BUILD_PLATFORM === "win32" ? "--win" : "--linux AppImage";
console.log(`[2/2] electron-builder (${platform})...`);
execSync(`npx electron-builder ${platform} --config electron-builder.config.cjs --publish never`, {
  stdio: "inherit",
  cwd: ROOT,
  // Remove variáveis de CI para o electron-builder não tentar publicar sozinho
  env: { ...process.env, CI: "", GITHUB_ACTIONS: "", BUILD_NUMBER: "" },
});

// Empacota saída em ZIP para o workflow electron-build.yml
const fs = require("fs");
const outDir = path.join(ROOT, "release-builds");
if (fs.existsSync(outDir)) {
  const target = process.env.BUILD_PLATFORM === "win32" ? "KeraDesktop-win32-x64.zip" : "KeraDesktop-linux-x64.zip";
  try {
    execSync(`cd "${outDir}" && zip -r "${target}" . -x "*.zip"`, { stdio: "inherit" });
  } catch (e) {
    console.warn("[zip] aviso:", e.message);
  }
}

console.log("\n✅ Pronto! Veja em release-builds/*.AppImage");
