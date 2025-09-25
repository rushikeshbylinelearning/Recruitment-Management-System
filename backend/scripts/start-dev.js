#!/usr/bin/env node

import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const backendDir = join(__dirname, '..');

console.log('🚀 Starting HR Workflow Management Backend...');
console.log('📁 Backend directory:', backendDir);

// Check if .env file exists
import fs from 'fs';
const envPath = join(backendDir, '.env');
if (!fs.existsSync(envPath)) {
  console.log('⚠️  .env file not found. Please create one based on .env.example');
  console.log('📝 Copy .env.example to .env and update the values');
  process.exit(1);
}

// Start the development server
const devProcess = spawn('npm', ['run', 'dev'], {
  cwd: backendDir,
  stdio: 'inherit',
  shell: true
});

devProcess.on('error', (error) => {
  console.error('❌ Failed to start development server:', error);
});

devProcess.on('close', (code) => {
  console.log(`🔄 Development server exited with code ${code}`);
});

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down development server...');
  devProcess.kill('SIGINT');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n🛑 Shutting down development server...');
  devProcess.kill('SIGTERM');
  process.exit(0);
});

