// Configuração do electron-builder.
// IMPORTANTE: troque "owner" e "repo" abaixo pelo seu repositório no GitHub.
// O auto-update vai buscar releases públicos em github.com/<owner>/<repo>/releases.
const path = require("path");

module.exports = {
  appId: "br.ia.kera.desktop",
  productName: "KeraDesktop",
  copyright: "© Kera",
  directories: {
    output: "release-builds",
    buildResources: "electron/build-resources",
  },
  files: [
    "dist/**/*",
    "electron/**/*.cjs",
    "electron/**/*.html",
    "package.json",
  ],
  asar: true,
  publish: [
    {
      provider: "github",
      owner: process.env.GH_OWNER || "djgeffy-cmyk",
      repo: process.env.GH_REPO || "kera-ai-nexus",
      releaseType: "release",
    },
  ],
  linux: {
    target: ["AppImage"],
    category: "Utility",
    artifactName: "KeraDesktop-${version}-${arch}.AppImage",
  },
  win: {
    target: ["nsis"],
    artifactName: "KeraDesktop-Setup-${version}.${ext}",
  },
};
