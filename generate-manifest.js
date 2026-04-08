const fs = require('fs-extra');
const crypto = require('crypto');
const path = require('path');

/**
 * CONFIGURAÇÕES DO MANIFESTO
 */
const CONFIG = {
  BASE_URL: 'https://raw.githubusercontent.com/LucasPaixaoCL/Drakoria-updates/main/',
  RELEASE_URL: 'https://github.com/LucasPaixaoCL/Drakoria-updates/releases/download/assets/',
  LARGE_FILE_THRESHOLD_MB: 50, // Arquivos maiores que isso vão para o Release automaticamente
  IGNORE_PATTERNS: [
    '.git', '.github', 'generate-manifest.js', 'manifest-standard.json', 
    'manifest-low.json', 'node_modules', 'package.json', 'package-lock.json',
    '.puzzle_cache', 'journeymap/cache', 'logs', 'backups', '.DS_Store', 'Thumbs.db'
  ],
  MANAGED_DIRS: ['mods', 'config', 'resourcepacks', 'shaderpacks', 'datapacks', 'defaultconfigs']
};

async function getFiles(dir) {
  if (!fs.existsSync(dir)) return [];
  const dirents = await fs.readdir(dir, { withFileTypes: true });
  const files = await Promise.all(dirents.map((dirent) => {
    const res = path.resolve(dir, dirent.name);
    return dirent.isDirectory() ? getFiles(res) : res;
  }));
  return Array.prototype.concat(...files);
}

async function calculateHash(filePath) {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('sha1');
    const stream = fs.createReadStream(filePath);
    stream.on('data', data => hash.update(data));
    stream.on('end', () => resolve(hash.digest('hex')));
    stream.on('error', err => reject(err));
  });
}

async function generate(preset) {
  const root = process.cwd();
  const allFiles = await getFiles(root);
  const manifest = { 
    version: Date.now().toString(), 
    generatedAt: new Date().toISOString(),
    preset: preset,
    files: [] 
  };

  console.log(`\n🔍 [${preset.toUpperCase()}] Escaneando diretórios...`);

  for (const fullPath of allFiles) {
    const relativePath = path.relative(root, fullPath).replace(/\\/g, '/');
    
    // Filtro de Ignorados
    if (CONFIG.IGNORE_PATTERNS.some(p => relativePath.includes(p))) continue;

    const stats = await fs.stat(fullPath);
    if (stats.isDirectory()) continue;

    const fileSizeMB = stats.size / (1024 * 1024);
    const isLarge = fileSizeMB > CONFIG.LARGE_FILE_THRESHOLD_MB;
    
    const hash = await calculateHash(fullPath);
    
    // Define a URL baseada no tamanho do arquivo (Híbrido Automático)
    const url = isLarge 
      ? `${CONFIG.RELEASE_URL}${encodeURIComponent(path.basename(relativePath))}`
      : `${CONFIG.BASE_URL}${encodeURI(relativePath)}`;

    if (isLarge) {
      console.log(`📦 [LARGE] ${relativePath} (${fileSizeMB.toFixed(2)} MB) -> Release URL`);
    }

    manifest.files.push({
      name: path.basename(relativePath),
      path: relativePath,
      hash: hash,
      size: stats.size,
      url: url
    });
  }

  const fileName = `manifest-${preset}.json`;
  await fs.writeJson(fileName, manifest, { spaces: 2 });
  console.log(`✅ [${preset.toUpperCase()}] Manifesto gerado: ${manifest.files.length} arquivos.`);
}

async function run() {
  console.log('🚀 Iniciando Gerador de Manifesto Drakoria v2.0');
  const startTime = Date.now();
  
  await generate('standard');
  await generate('low');
  
  const duration = ((Date.now() - startTime) / 1000).toFixed(2);
  console.log(`\n✨ Sincronização concluída em ${duration}s!`);
}

run().catch(err => {
  console.error('❌ Erro crítico:', err);
  process.exit(1);
});
