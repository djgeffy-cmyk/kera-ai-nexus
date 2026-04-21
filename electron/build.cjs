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

// Empacota saída em ZIP para o workflow electron-build.yml (cross-platform via archiver)
const fs = require("fs");
const archiver = require("archiver");

const outDir = path.join(ROOT, "release-builds");

function shouldSkip(name) {
  const lower = name.toLowerCase();
  if (lower.endsWith(".zip")) return true;
  if (lower.endsWith(".blockmap")) return true;
  if (lower.startsWith("builder-") && lower.endsWith(".yml")) return true;
  if (lower.startsWith("latest") && lower.endsWith(".yml")) return true;
  return false;
}

async function zipArtifacts() {
  if (!fs.existsSync(outDir)) {
    console.warn("[zip] release-builds não existe — pulando.");
    return;
  }

  const target =
    process.env.BUILD_PLATFORM === "win32"
      ? "KeraDesktop-win32-x64.zip"
      : "KeraDesktop-linux-x64.zip";
  const targetPath = path.join(outDir, target);

  // Remove ZIPs antigos
  for (const f of fs.readdirSync(outDir)) {
    if (f.toLowerCase().endsWith(".zip")) {
      try { fs.unlinkSync(path.join(outDir, f)); } catch {}
    }
  }

  const entries = fs.readdirSync(outDir).filter((f) => !shouldSkip(f));
  if (entries.length === 0) {
    console.error("[zip] nenhum artefato encontrado em release-builds!");
    process.exit(1);
  }

  console.log(`[zip] criando ${target} com ${entries.length} item(s):`);
  entries.forEach((e) => console.log("  -", e));

  await new Promise((resolve, reject) => {
    const output = fs.createWriteStream(targetPath);
    const archive = archiver("zip", { zlib: { level: 9 } });

    output.on("close", resolve);
    archive.on("error", reject);
    archive.pipe(output);

    for (const entry of entries) {
      const full = path.join(outDir, entry);
      const stat = fs.statSync(full);
      if (stat.isDirectory()) {
        archive.directory(full, entry);
      } else {
        archive.file(full, { name: entry });
      }
    }

    archive.finalize();
  });

  const sizeMb = (fs.statSync(targetPath).size / (1024 * 1024)).toFixed(2);
  console.log(`[zip] ✅ ${target} criado (${sizeMb} MB)`);
}

zipArtifacts()
  .then(() => console.log("\n✅ Pronto! Veja em release-builds/"))
  .catch((e) => {
    console.error("[zip] erro:", e);
    process.exit(1);
  });
