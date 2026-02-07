import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const versionFilePath = path.join(__dirname, '../public/version.json');

// Read existing version or default
let currentVersion = { version: '1.0.0', buildTime: 0 };
try {
  if (fs.existsSync(versionFilePath)) {
    const data = fs.readFileSync(versionFilePath, 'utf-8');
    currentVersion = JSON.parse(data);
  }
} catch (e) {
  console.warn('Could not read version.json, starting fresh.');
}

// Increment build number or use timestamp
const newVersionData = {
  version: currentVersion.version || '1.0.0',
  buildTime: Date.now()
};

// Ensure public directory exists
const publicDir = path.dirname(versionFilePath);
if (!fs.existsSync(publicDir)) {
  fs.mkdirSync(publicDir, { recursive: true });
}

fs.writeFileSync(versionFilePath, JSON.stringify(newVersionData, null, 2));

console.log('Updated version.json with build time:', newVersionData.buildTime);
