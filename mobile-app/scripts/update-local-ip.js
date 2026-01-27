#!/usr/bin/env node

/**
 * Auto-detect local IP address and update .env.local
 * Run this when your IP changes (e.g. new Wi-Fi) so the app can reach your local backend.
 *
 * Usage: node scripts/update-local-ip.js
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const projectRoot = path.resolve(__dirname, '..');
const envLocalPath = path.join(projectRoot, '.env.local');

function getLocalIP() {
  try {
    const result = execSync(
      "ifconfig | grep -E 'inet ' | grep -v 127.0.0.1 | awk '{print $2}' | head -1",
      { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'ignore'] }
    );
    const ip = result.trim();
    if (ip && /^\d+\.\d+\.\d+\.\d+$/.test(ip)) return ip;
  } catch {
    try {
      const result = execSync('ipconfig getifaddr en0 || ipconfig getifaddr en1', {
        encoding: 'utf-8',
        stdio: ['pipe', 'pipe', 'ignore'],
      });
      const ip = result.trim();
      if (ip && /^\d+\.\d+\.\d+\.\d+$/.test(ip)) return ip;
    } catch {
      console.warn('Could not auto-detect IP address');
    }
  }
  return null;
}

function readEnvFile() {
  if (fs.existsSync(envLocalPath)) {
    return fs.readFileSync(envLocalPath, 'utf-8');
  }
  const envPath = path.join(projectRoot, '.env');
  if (fs.existsSync(envPath)) {
    return fs.readFileSync(envPath, 'utf-8');
  }
  return '';
}

function updateApiUrl(content, newIP) {
  const newUrl = `http://${newIP}:3000`;
  const lines = content.split('\n');
  let found = false;
  const updated = lines.map((line) => {
    if (line.trim().startsWith('EXPO_PUBLIC_API_URL=')) {
      found = true;
      return `EXPO_PUBLIC_API_URL=${newUrl}`;
    }
    return line;
  });
  if (!found) {
    updated.push(`EXPO_PUBLIC_API_URL=${newUrl}`);
  }
  return updated.join('\n');
}

function main() {
  const ip = getLocalIP();
  if (!ip) {
    console.warn('Could not auto-detect local IP. Set EXPO_PUBLIC_API_URL manually in .env.local');
    return;
  }
  console.log('Detected local IP:', ip);
  let content = readEnvFile();
  content = updateApiUrl(content, ip);
  fs.writeFileSync(envLocalPath, content, 'utf-8');
  console.log('Updated .env.local: EXPO_PUBLIC_API_URL=http://' + ip + ':3000');
}

main();
