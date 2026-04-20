const packager = require('@electron/packager');
const path = require('path');
const fs = require('fs');
const zip = require('bestzip');
const { execSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');

async function bundle() {
    console.log('--- Geverson, iniciando o empacotamento... segura a onda ---');
    
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
        platform: 'win32',
        arch: 'x64',
        out: 'dist-electron',
        overwrite: true,
        asar: true,
        prune: true,
        electronVersion: '33.0.0', // Atualizado para uma versão estável recente compatível com o projeto
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
    const outputZip = path.join(releaseDir, 'KeraDesktop-win32-x64.zip');
    
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
