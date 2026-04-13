#!/usr/bin/env node
// Build script: injects ANTHROPIC_API_KEY into index.html -> dist/index.html
// Usage: node build.js
//   Key is read from ANTHROPIC_API_KEY env var or .env.local file.

const fs   = require('fs');
const path = require('path');

// Load .env.local if present (won't override already-set env vars)
const envLocal = path.join(__dirname, '.env.local');
if (fs.existsSync(envLocal)) {
  fs.readFileSync(envLocal, 'utf8').split('\n').forEach(function (line) {
    var m = line.match(/^([^=]+)=(.*)$/);
    if (m && !process.env[m[1].trim()]) {
      process.env[m[1].trim()] = m[2].trim().replace(/^["']|["']$/g, '');
    }
  });
}

var key = process.env.ANTHROPIC_API_KEY;
if (!key) {
  console.error('Error: ANTHROPIC_API_KEY is not set. Add it to .env.local or export it before running this script.');
  process.exit(1);
}

var src = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
if (!src.includes('__ANTHROPIC_API_KEY__')) {
  console.error('Error: placeholder __ANTHROPIC_API_KEY__ not found in index.html.');
  process.exit(1);
}

var out = src.replace('__ANTHROPIC_API_KEY__', key);

var distDir = path.join(__dirname, 'dist');
if (!fs.existsSync(distDir)) fs.mkdirSync(distDir);
fs.writeFileSync(path.join(distDir, 'index.html'), out);
console.log('Built dist/index.html with API key injected.');
