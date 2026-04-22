// Build local + empacotamento por sistema.
// Em CI (electron-build.yml) este script roda em runners win/mac/linux.
//
// IMPORTANTE pro auto-update:
// - electron-updater precisa dos arquivos `latest.yml` (Win),
//   `latest-mac.yml` (macOS), `latest-linux.yml` (Linux) no Release.
// - Os instaladores (.exe, .dmg, .zip mac, .AppImage) ficam SOLTOS no Release,
//   NÃO podem estar dentro de um zip-coletor.
// - .blockmap são opcionais mas habilitam delta-updates → manter.
const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");
const archiver = require("archiver");

const ROOT = path.resolve(__dirname, "..");
const OUT = path.join(ROOT, "release-builds");

console.log("[1/2] Vite build...");
execSync("npm run build", {
  stdio: "inherit",
  cwd: ROOT,
  env: { ...process.env, ELECTRON_BUILD: "true" },
});

let platformFlag;
if (process.env.BUILD_PLATFORM === "win32") {
  platformFlag = "--win";
} else if (process.env.BUILD_PLATFORM === "darwin") {
  // Builda DMG + ZIP nos dois archs — necessário pro updater do macOS
  const arch = process.env.BUILD_ARCH === "arm64" ? "--arm64" : "--x64";
  platformFlag = `--mac dmg zip ${arch}`;
} else {
  platformFlag = "--linux AppImage";
}

console.log(`[2/2] electron-builder (${platformFlag})...`);
execSync(
  `npx electron-builder ${platformFlag} --config electron-builder.config.cjs --publish never`,
  {
    stdio: "inherit",
    cwd: ROOT,
    // Limpa env de CI pra evitar publicação implícita (release.yml cuida disso)
    env: { ...process.env, CI: "", GITHUB_ACTIONS: "", BUILD_NUMBER: "" },
  },
);

// Empacota um ZIP de "snapshot" pra inspeção/CI artifact — mantém TODOS os
// arquivos originais (incluindo latest*.yml e .blockmap) intactos no disco
// pra serem subidos no Release pelo workflow.
function listOutputs() {
  if (!fs.existsSync(OUT)) return [];
  return fs.readdirSync(OUT).filter((f) => {
    const lower = f.toLowerCase();
    if (lower.endsWith(".zip") && lower.startsWith("keradesktop-snapshot")) return false;
    return true;
  });
}

async function snapshotZip() {
  const entries = listOutputs();
  if (entries.length === 0) {
    console.error("[snapshot] nada em release-builds!");
    process.exit(1);
  }

  let target;
  if (process.env.BUILD_PLATFORM === "win32") {
    target = "KeraDesktop-snapshot-win32-x64.zip";
  } else if (process.env.BUILD_PLATFORM === "darwin") {
    const a = process.env.BUILD_ARCH === "arm64" ? "arm64" : "x64";
    target = `KeraDesktop-snapshot-darwin-${a}.zip`;
  } else {
    target = "KeraDesktop-snapshot-linux-x64.zip";
  }
  const targetPath = path.join(OUT, target);

  console.log(`[snapshot] criando ${target} com ${entries.length} item(s):`);
  entries.forEach((e) => console.log("  -", e));

  await new Promise((resolve, reject) => {
    const output = fs.createWriteStream(targetPath);
    const archive = archiver("zip", { zlib: { level: 9 } });
    output.on("close", resolve);
    archive.on("error", reject);
    archive.pipe(output);
    for (const entry of entries) {
      const full = path.join(OUT, entry);
      const stat = fs.statSync(full);
      if (stat.isDirectory()) archive.directory(full, entry);
      else archive.file(full, { name: entry });
    }
    archive.finalize();
  });

  const sizeMb = (fs.statSync(targetPath).size / (1024 * 1024)).toFixed(2);
  console.log(`[snapshot] ✅ ${target} (${sizeMb} MB)`);
}

snapshotZip()
  .then(() => {
    console.log("\n✅ Pronto! Veja em release-builds/");
    console.log("   Os instaladores e os arquivos latest*.yml ficaram SOLTOS — ");
    console.log("   o workflow de release deve subir todos pro GitHub Release.");
  })
  .catch((e) => {
    console.error("[snapshot] erro:", e);
    process.exit(1);
  });