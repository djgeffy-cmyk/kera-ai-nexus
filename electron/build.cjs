// Script de build: faz vite build com base relativa, depois empacota com
// @electron/packager pro Windows e gera um .zip pronto pro download.
const { execSync } = require("child_process");
const path = require("path");
const fs = require("fs");

const ROOT = path.resolve(__dirname, "..");
const OUT = path.join(ROOT, "electron-release");

function run(cmd, env = {}) {
  console.log("\n$", cmd);
  execSync(cmd, { stdio: "inherit", cwd: ROOT, env: { ...process.env, ...env } });
}

console.log("[1/3] Build Vite com base relativa...");
run("npx vite build", { ELECTRON_BUILD: "true" });

console.log("[2/3] Empacotar Electron pra Windows...");
if (fs.existsSync(OUT)) fs.rmSync(OUT, { recursive: true });
run(
  [
    "npx @electron/packager .",
    '"KeraDesktop"',
    "--platform=win32",
    "--arch=x64",
    "--out=electron-release",
    "--overwrite",
    `--app-version=1.0.0`,
    `--ignore="^/src"`,
    `--ignore="^/public"`,
    `--ignore="^/electron-release"`,
    `--ignore="^/supabase"`,
    `--ignore="^/mem"`,
    `--ignore="^/.git"`,
  ].join(" ")
);

console.log("[3/3] Gerando .zip em /mnt/documents/KeraDesktop-win32-x64.zip...");
const target = "/mnt/documents/KeraDesktop-win32-x64.zip";
if (fs.existsSync(target)) fs.unlinkSync(target);
run(`nix run nixpkgs#zip -- -r ${target} KeraDesktop-win32-x64`, { CWD: OUT });
// `cd` precisa estar no comando porque execSync respeita o `cwd:` do options:
run(`cd ${OUT} && nix run nixpkgs#zip -- -r ${target} KeraDesktop-win32-x64`);

console.log("\n✅ Pronto! Arquivo: " + target);
