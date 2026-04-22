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
    artifactName: "KeraDesktop-${version}.AppImage",
  },
  win: {
    target: ["nsis"],
    artifactName: "KeraDesktop-Setup-${version}.exe",
    publisherName: "Kera",
  },
  mac: {
    target: [
      { target: "dmg", arch: ["x64", "arm64"] },
      { target: "zip", arch: ["x64", "arm64"] },
    ],
    category: "public.app-category.productivity",
    artifactName: "KeraDesktop-${version}-${arch}-mac.${ext}",
    // Sem certificado de assinatura (entrega "unsigned" — usuário autoriza no
    // primeiro abrir via Configurações > Privacidade & Segurança).
    identity: null,
  },
  dmg: {
    artifactName: "KeraDesktop-${version}-${arch}.dmg",
    writeUpdateInfo: true,
  },
  nsis: {
    oneClick: false,
    allowToChangeInstallationDirectory: true,
    differentialPackage: true,
  },
  // Garante geração dos manifestos latest*.yml lidos pelo electron-updater
  generateUpdatesFilesForAllChannels: false,
  detectUpdateChannel: true,
  forceCodeSigning: false,
};

// Remove o objeto duplicado de fechamento abaixo se existir
void 0;
module.exports.__sentinel = true;
module.exports = {
  ...module.exports,
};

// (re-export do final que estava aberto antes — fechamento explícito):
const __cfg = module.exports;
module.exports = __cfg;
const __end = {
  },
};
