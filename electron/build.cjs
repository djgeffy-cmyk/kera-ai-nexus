const packager = require('@electron/packager').default || require('@electron/packager');
const path = require('path');
const fs = require('fs');
const zip = require('bestzip');
const { execSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');

// Plataforma alvo: definida pela env BUILD_PLATFORM (win32 | linux | darwin).
// Default = win32 pra manter retrocompatibilidade.
const PLATFORM = process.env.BUILD_PLATFORM || 'win32';
const ARCH = process.env.BUILD_ARCH || 'x64';
const ARTIFACT_NAME = `KeraDesktop-${PLATFORM}-${ARCH}`;

async function bundle() {
    console.log('--- Geverson, iniciando o empacotamento... segura a onda ---');
    console.log(`Alvo: ${PLATFORM}-${ARCH}`);
    
    // 1. Build Vite
    console.log('[1/3] Gerando build do Vite...');
    try {
        execSync('npm run build', { stdio: 'inherit', cwd: ROOT, env: { ...process.env, ELECTRON_BUILD: 'true' } });
    } catch (err) {
        console.error('Erro no build do Vite:', err);
        process.exit(1);
    }

    // 2. Empacotar com Electron Packager
    console.log('[2/3] Empacotando com Electron Packager...');
    const outDir = path.join(ROOT, 'dist-electron');
    
    if (fs.existsSync(outDir)) {
        fs.rmSync(outDir, { recursive: true, force: true });
    }

    const appPaths = await packager({
        dir: '.',
        name: 'KeraDesktop',
        platform: PLATFORM,
        arch: ARCH,
        out: 'dist-electron',
        overwrite: true,
        asar: true,
        prune: true,
        electronVersion: '41.2.1', // Sincronizado com devDependencies
        ignore: [
            /^\/src/,
            /^\/public/,
            /^\/supabase/,
            /^\/.git/,
            /^\/node_modules/, // O packager lida com isso se prune for true, mas as vezes é bom reforçar
            /^\/dist-electron/
        ]
    });

    const buildPath = appPaths[0];
    console.log(`Build finalizado em: ${buildPath}`);

    // 3. Compactar para ZIP
    const releaseDir = path.join(ROOT, 'release-builds');
    const outputZip = path.join(releaseDir, `${ARTIFACT_NAME}.zip`);
    
    if (!fs.existsSync(releaseDir)) {
        fs.mkdirSync(releaseDir, { recursive: true });
    }

    if (fs.existsSync(outputZip)) {
        fs.unlinkSync(outputZip);
    }

    console.log('[3/3] Compactando para ZIP...');
    
    try {
        const relativeBuildPath = path.relative(ROOT, buildPath);
        await zip({
            source: '*',
            destination: outputZip,
            cwd: buildPath
        });
        console.log(`\n✅ Build ZIP pronto, Geverson! Arquivo disponível em: ${outputZip}`);
    } catch (err) {
        console.error('Erro na compressão:', err);
        process.exit(1);
    }
}

bundle();
