import sharp from 'sharp';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Read the SVG logo
const svgLogo = fs.readFileSync('./public/icons/trollcity-logo.svg', 'utf8');

// Create icons in different sizes
const iconSizes = [72, 96, 128, 144, 152, 192, 384, 512];

async function generateIcons() {
  try {
    // Generate main app icons
    for (const size of iconSizes) {
      const buffer = await sharp(Buffer.from(svgLogo))
        .resize(size, size)
        .png()
        .toBuffer();
      
      const filename = `icon-${size}x${size}.png`;
      const filepath = path.join('./public/icons', filename);
      
      fs.writeFileSync(filepath, buffer);
      console.log(`✅ Generated ${filename}`);
    }

    // Generate shortcut icons with different colors
    const shortcuts = [
      { name: 'go-live', color: '#ff6b6b' },
      { name: 'store', color: '#4ecdc4' },
      { name: 'earnings', color: '#45b7d1' }
    ];

    for (const shortcut of shortcuts) {
      // Create a colored background with the logo
      const buffer = await sharp({
        create: {
          width: 192,
          height: 192,
          channels: 4,
          background: shortcut.color
        }
      })
      .composite([{
        input: await sharp(Buffer.from(svgLogo))
          .resize(128, 128)
          .toBuffer(),
        gravity: 'center'
      }])
      .png()
      .toBuffer();

      const filename = `${shortcut.name}.png`;
      const filepath = path.join('./public/icons', filename);
      
      fs.writeFileSync(filepath, buffer);
      console.log(`✅ Generated ${filename}`);
    }

    console.log('🎉 All icons generated successfully!');
  } catch (error) {
    console.error('❌ Error generating icons:', error);
  }
}

// Run the generation
generateIcons();