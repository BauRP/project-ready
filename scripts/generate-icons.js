/**
 * Android Icon Generator Script
 * Run: node scripts/generate-icons.js
 * 
 * This creates properly sized icons for all Android densities.
 * In CI, we use ImageMagick (convert) to resize the source icon.
 */

import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SOURCE_ICON = path.resolve(__dirname, '../src/assets/trivo-icon.png');
const ANDROID_RES = path.resolve(__dirname, '../android/app/src/main/res');

const densities = [
  { folder: 'mipmap-hdpi', size: 72 },
  { folder: 'mipmap-mdpi', size: 48 },
  { folder: 'mipmap-xhdpi', size: 96 },
  { folder: 'mipmap-xxhdpi', size: 144 },
  { folder: 'mipmap-xxxhdpi', size: 192 },
];

const foregroundDensities = [
  { folder: 'mipmap-hdpi', size: 162 },
  { folder: 'mipmap-mdpi', size: 108 },
  { folder: 'mipmap-xhdpi', size: 216 },
  { folder: 'mipmap-xxhdpi', size: 324 },
  { folder: 'mipmap-xxxhdpi', size: 432 },
];

// Bold launcher icons: inner logo at 65% of icon area on a solid white background.
for (const d of densities) {
  const dir = path.join(ANDROID_RES, d.folder);
  fs.mkdirSync(dir, { recursive: true });
  const inner = Math.round(d.size * 0.65);
  try {
    execSync(`convert "${SOURCE_ICON}" -resize ${inner}x${inner} -background white -gravity center -extent ${d.size}x${d.size} "${path.join(dir, 'ic_launcher.png')}"`, { stdio: 'inherit' });
    execSync(`convert "${SOURCE_ICON}" -resize ${inner}x${inner} -background white -gravity center -extent ${d.size}x${d.size} "${path.join(dir, 'ic_launcher_round.png')}"`, { stdio: 'inherit' });
    console.log(`✓ ${d.folder}: ${d.size}x${d.size} (inner ${inner}px, 65%)`);
  } catch {
    fs.copyFileSync(SOURCE_ICON, path.join(dir, 'ic_launcher.png'));
    fs.copyFileSync(SOURCE_ICON, path.join(dir, 'ic_launcher_round.png'));
    console.log(`⚠ ${d.folder}: copied source (ImageMagick not available)`);
  }
}

// Adaptive foreground: inner logo at 65% of foreground canvas, transparent bg.
for (const d of foregroundDensities) {
  const dir = path.join(ANDROID_RES, d.folder);
  fs.mkdirSync(dir, { recursive: true });
  const inner = Math.round(d.size * 0.65);
  try {
    execSync(`convert "${SOURCE_ICON}" -resize ${inner}x${inner} -background none -gravity center -extent ${d.size}x${d.size} "${path.join(dir, 'ic_launcher_foreground.png')}"`, { stdio: 'inherit' });
    console.log(`✓ ${d.folder} foreground: ${d.size}x${d.size} (inner ${inner}px, 65%)`);
  } catch {
    fs.copyFileSync(SOURCE_ICON, path.join(dir, 'ic_launcher_foreground.png'));
    console.log(`⚠ ${d.folder} foreground: copied source`);
  }
}

console.log('\n✅ Android icons generated successfully!');
