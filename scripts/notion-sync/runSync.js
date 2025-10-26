#!/usr/bin/env node

/**
 * Simple sync runner for Notion to SSG
 * Usage: node scripts/notion-sync/runSync.js [options]
 */

const { spawn } = require('child_process');
const path = require('path');

// Parse command line arguments
const args = process.argv.slice(2);
const isDev = args.includes('--dev') || args.includes('-d');
const isWatch = args.includes('--watch') || args.includes('-w');

console.log('🚀 Starting Notion sync...');

// Set environment file
const envFile = isDev ? '.env.development' : '.env';

// Command to run
const command = `node --env-file=${envFile} ${path.join(__dirname, 'syncFromNotion.ts')}`;

console.log(`📝 Using environment: ${envFile}`);

// Run the sync script
const child = spawn(command, [], {
  stdio: 'inherit',
  shell: true,
  cwd: path.resolve(__dirname, '../..')
});

child.on('error', (error) => {
  console.error('❌ Sync failed:', error.message);
  process.exit(1);
});

child.on('exit', (code) => {
  if (code === 0) {
    console.log('✅ Sync completed successfully!');

    if (!isWatch) {
      console.log('📝 Next steps:');
      console.log('  npm run build    # Build the site');
      console.log('  npm run dev      # Start development server');
    }
  } else {
    console.error(`❌ Sync failed with exit code ${code}`);
    process.exit(code);
  }
});

// Handle watch mode if needed
if (isWatch) {
  console.log('👀 Watch mode enabled - Press Ctrl+C to stop');

  const chokidar = require('chokidar');

  // Watch for changes in sync script or config
  const watcher = chokidar.watch([
    path.join(__dirname, 'syncFromNotion.ts'),
    path.join(__dirname, '..', 'src', 'content', 'config.ts'),
    '.env'
  ]);

  let debouncedTimer;

  watcher.on('change', () => {
    clearTimeout(debouncedTimer);

    debouncedTimer = setTimeout(() => {
      console.log('🔄 Changes detected, syncing again...');

      const newChild = spawn(command, [], {
        stdio: 'inherit',
        shell: true,
        cwd: path.resolve(__dirname, '../..')
      });

      newChild.on('exit', (code) => {
        if (code === 0) {
          console.log('✅ Auto-sync completed!');
        } else {
          console.error('❌ Auto-sync failed');
        }
      });
    }, 2000); // 2 second debounce
  });
}
