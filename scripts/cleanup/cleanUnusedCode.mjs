#!/usr/bin/env node

import fs from 'fs/promises';
import path from 'path';
import { execSync } from 'child_process';

console.log('🧹 Cleaning unused code and dependencies...\n');

// Function to check if file is used
async function isFileUsed(filePath) {
  const relativePath = path.relative(process.cwd(), filePath);

  try {
    // Use ripgrep if available (faster than grep)
    const cmd = process.platform === 'win32' ? 'where rg' : 'which rg';
    try {
      execSync(cmd, { stdio: 'ignore' });
      const result = execSync(`rg "${relativePath}" --type-not ignore`, {
        encoding: 'utf8',
        stdio: 'pipe'
      });
      return result.trim().length > 0;
    } catch {
      // Fallback to grep if ripgrep not available
      const result = execSync(`grep -r "${relativePath}" --exclude-dir=node_modules --exclude-dir=.git --exclude-dir=dist .`, {
        encoding: 'utf8',
        stdio: 'pipe'
      });
      return result.trim().length > 0;
    }
  } catch {
    return false;
  }
}

// Clean unused folders
async function cleanFolders() {
  console.log('📁 Checking unused folders...');

  const unusedFolders = [
    'blog-nextjs',
    'blog-rebuild/blog-rebuild',
    'middleware',
    'src/assets/images'
  ];

  for (const folder of unusedFolders) {
    try {
      await fs.access(folder);
      const stats = await fs.stat(folder);

      if (stats.isDirectory()) {
        console.log(`  🗑️  Removing unused folder: ${folder}`);
        await fs.rm(folder, { recursive: true, force: true });
      }
    } catch {
      console.log(`  ✅ Folder doesn't exist: ${folder}`);
    }
  }
}

// Clean unused files
async function cleanFiles() {
  console.log('\n📄 Checking unused files...');

  const unusedFiles = [
    'src/libs/notion.types.ts',
    'src/helpers/images.mjs'
  ];

  for (const file of unusedFiles) {
    try {
      await fs.access(file);
      const stats = await fs.stat(file);

      if (stats.isFile()) {
        const isUsed = await isFileUsed(file);
        if (!isUsed) {
          console.log(`  🗑️  Removing unused file: ${file}`);
          await fs.unlink(file);
        } else {
          console.log(`  ✅ File is in use: ${file}`);
        }
      }
    } catch {
      console.log(`  ✅ File doesn't exist: ${file}`);
    }
  }
}

// Create lean package.json suggestions
async function suggestPackageCleanup() {
  console.log('\n📦 Dependencies that can be removed:');

  const unusedDeps = [
    '@astrojs/node - SSR adapter (not needed for SSG)',
    '@upstash/redis - KV cache (not used)',
    '@vite-pwa/astro - PWA (commented out)',
    '@resvg/resvg-js - OG image generation (externalized)',
    'prismjs - Syntax highlighting (using shiki instead)',
    'workbox-core - Service worker (PWA not active)',
    'workbox-expiration - Service worker (PWA not active)',
    'workbox-precaching - Service worker (PWA not active)',
    'workbox-routing - Service worker (PWA not active)',
    'workbox-strategies - Service worker (PWA not active)',
    'workbox-window - Service worker (PWA not active)'
  ];

  unusedDeps.forEach(dep => {
    console.log(`  ❌ ${dep}`);
  });

  console.log('\n📜 Scripts that can be removed:');
  const unusedScripts = [
    'cache:warm - KV cache warming',
    'cache:stats - KV cache statistics',
    'cache:clear - KV cache clearing',
    'cache:invalidate:* - Cache invalidation APIs',
    'cache:health - Redis health check'
  ];

  unusedScripts.forEach(script => {
    console.log(`  ❌ ${script}`);
  });

  console.log('\n💡 To remove these dependencies, run:');
  console.log('   npm remove @astrojs/node @upstash/redis @vite-pwa/astro @resvg/resvg-js prismjs workbox-core workbox-expiration workbox-precaching workbox-routing workbox-strategies workbox-window');
}

// Clean astro.config.mjs
// astro.config.mjs is already clean - no cleanup needed
async function cleanAstroConfig() {
  console.log('\n⚙️  Astro config is already clean');
  console.log('  ✅ astro.config.mjs is already clean');
}

// Update .gitignore
async function updateGitignore() {
  console.log('\n📝 Updating .gitignore...');

  try {
    const gitignorePath = '.gitignore';
    const content = await fs.readFile(gitignorePath, 'utf8');

    if (!content.includes('blog-nextjs')) {
      const updated = content + '\n# Legacy/unused folders\nblog-nextjs/\nblog-rebuild/blog-rebuild/\nmiddleware/\nsrc/assets/images/\n';
      await fs.writeFile(gitignorePath, updated);
      console.log('  ✅ Added unused folders to .gitignore');
    } else {
      console.log('  ✅ .gitignore already up to date');
    }
  } catch (error) {
    console.log('  ❌ Error updating .gitignore:', error.message);
  }
}

async function main() {
  try {
    await cleanFolders();
    await cleanFiles();
    // await cleanAstroConfig(); // No longer needed
    await updateGitignore();
    await suggestPackageCleanup();

    console.log('\n🎉 Cleanup completed!');
    console.log('\n📋 Next steps:');
    console.log('1. Review and remove unused dependencies:');
    console.log('   npm remove @astrojs/node @upstash/redis @vite-pwa/astro @resvg/resvg-js prismjs workbox-core workbox-expiration workbox-precaching workbox-routing workbox-strategies workbox-window');
    console.log('2. Remove unused scripts from package.json');
    console.log('3. Run: npm install to clean node_modules');
    console.log('4. Run: npm run build to test everything still works');

  } catch (error) {
    console.error('❌ Cleanup failed:', error);
    process.exit(1);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { main as cleanupUnused };
