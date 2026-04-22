// Configuração do electron-builder.
// Publicação automática no GitHub Releases — é de lá que o electron-updater
// lê os manifestos `latest.yml` (Win), `latest-mac.yml` (macOS) e
// `latest-linux.yml` (Linux) pra detectar versões novas.
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
      // vPrefixedTagName=true (padrão) — releases ficam como v0.1.1
    },
  ],

  // Linux: gera .deb + AppImage. O .deb é mais simples pra instalar em Ubuntu,
  // enquanto o AppImage continua útil como versão portátil e pro auto-update.
  linux: {
    target: [
      { target: "deb", arch: ["x64"] },
      { target: "AppImage", arch: ["x64"] },
    ],
    category: "Utility",
    artifactName: "${productName}-${version}.${ext}",
  },

  // Windows: NSIS gera `KeraDesktop-Setup-<v>.exe` + latest.yml + .blockmap.
  // differentialPackage habilita delta updates (mais leve).
  win: {
    target: [{ target: "nsis", arch: ["x64"] }],
    artifactName: "KeraDesktop-Setup-${version}.exe",
  },
  nsis: {
    oneClick: false,
    perMachine: false,
    allowToChangeInstallationDirectory: true,
    differentialPackage: true,
  },

  // macOS: precisa de DMG **e** ZIP. O electron-updater no macOS só sabe
  // baixar via ZIP — o DMG é só pra primeira instalação manual pelo usuário.
  // Sem o ZIP, latest-mac.yml não fica completo e a atualização falha.
  mac: {
    target: [
      { target: "dmg", arch: ["x64", "arm64"] },
      { target: "zip", arch: ["x64", "arm64"] },
    ],
    category: "public.app-category.productivity",
    artifactName: "KeraDesktop-${version}-${arch}-mac.${ext}",
    identity: null, // unsigned — usuário autoriza no Gatekeeper
  },
  dmg: {
    artifactName: "KeraDesktop-${version}-${arch}.dmg",
    writeUpdateInfo: false, // updater usa o ZIP, não o DMG
  },

  // Garante geração dos manifestos latest*.yml em todos os canais
  generateUpdatesFilesForAllChannels: false,
  forceCodeSigning: false,
};