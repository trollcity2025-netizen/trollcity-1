import sharp from 'sharp';
import fs from 'fs';

async function generateScreenshots() {
  try {
    // Generate desktop screenshot (1280x720)
    const desktopBuffer = await sharp({
      create: {
        width: 1280,
        height: 720,
        channels: 4,
        background: {
          r: 10,
          g: 10,
          b: 15,
          alpha: 1
        }
      }
    })
    .composite([
      {
        input: await sharp(Buffer.from(`
          <svg width="1280" height="720" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" style="stop-color:#7c3aed;stop-opacity:0.1" />
                <stop offset="100%" style="stop-color:#0a0a0f;stop-opacity:1" />
              </linearGradient>
            </defs>
            <rect width="1280" height="720" fill="url(#bg)"/>
            <text x="640" y="200" text-anchor="middle" font-family="Arial, sans-serif" font-size="48" font-weight="bold" fill="#7c3aed">TrollCity</text>
            <text x="640" y="280" text-anchor="middle" font-family="Arial, sans-serif" font-size="24" fill="#a855f7">The Ultimate Streaming Platform</text>
            <rect x="240" y="320" width="800" height="200" rx="20" fill="#1a1a24" stroke="#7c3aed" stroke-width="2"/>
            <text x="640" y="380" text-anchor="middle" font-family="Arial, sans-serif" font-size="18" fill="#c084fc">Live Streaming • Gift System • Family Payouts</text>
            <text x="640" y="420" text-anchor="middle" font-family="Arial, sans-serif" font-size="18" fill="#c084fc">Admin Dashboard • Safety Features • Mobile Ready</text>
            <text x="640" y="460" text-anchor="middle" font-family="Arial, sans-serif" font-size="18" fill="#c084fc">Troll Officer System • Earnings Management</text>
          </svg>
        `)).toBuffer(),
        gravity: 'center'
      }
    ])
    .png()
    .toBuffer();

    fs.writeFileSync('./public/screenshots/desktop-screenshot.png', desktopBuffer);
    console.log('✅ Generated desktop-screenshot.png');

    // Generate mobile screenshot (390x844)
    const mobileBuffer = await sharp({
      create: {
        width: 390,
        height: 844,
        channels: 4,
        background: {
          r: 10,
          g: 10,
          b: 15,
          alpha: 1
        }
      }
    })
    .composite([
      {
        input: await sharp(Buffer.from(`
          <svg width="390" height="844" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" style="stop-color:#7c3aed;stop-opacity:0.2" />
                <stop offset="100%" style="stop-color:#0a0a0f;stop-opacity:1" />
              </linearGradient>
            </defs>
            <rect width="390" height="844" fill="url(#bg)"/>
            <text x="195" y="200" text-anchor="middle" font-family="Arial, sans-serif" font-size="36" font-weight="bold" fill="#7c3aed">TrollCity</text>
            <text x="195" y="250" text-anchor="middle" font-family="Arial, sans-serif" font-size="18" fill="#a855f7">Mobile Streaming</text>
            <rect x="45" y="300" width="300" height="150" rx="15" fill="#1a1a24" stroke="#7c3aed" stroke-width="2"/>
            <text x="195" y="340" text-anchor="middle" font-family="Arial, sans-serif" font-size="14" fill="#c084fc">Live Streams</text>
            <text x="195" y="370" text-anchor="middle" font-family="Arial, sans-serif" font-size="14" fill="#c084fc">Gift System</text>
            <text x="195" y="400" text-anchor="middle" font-family="Arial, sans-serif" font-size="14" fill="#c084fc">Family Features</text>
            <rect x="45" y="480" width="300" height="100" rx="15" fill="#1a1a24" stroke="#7c3aed" stroke-width="2"/>
            <text x="195" y="520" text-anchor="middle" font-family="Arial, sans-serif" font-size="14" fill="#c084fc">PWA Ready</text>
            <text x="195" y="550" text-anchor="middle" font-family="Arial, sans-serif" font-size="14" fill="#c084fc">Install on Mobile</text>
          </svg>
        `)).toBuffer(),
        gravity: 'center'
      }
    ])
    .png()
    .toBuffer();

    fs.writeFileSync('./public/screenshots/mobile-screenshot.png', mobileBuffer);
    console.log('✅ Generated mobile-screenshot.png');

    console.log('🎉 All screenshots generated successfully!');
  } catch (error) {
    console.error('❌ Error generating screenshots:', error);
  }
}

// Run the generation
generateScreenshots();