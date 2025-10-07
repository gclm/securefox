import sharp from 'sharp';
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 定义需要生成的图标尺寸
const sizes = [16, 32, 48, 96, 128];

// 输入SVG文件路径
const inputSvg = path.join(__dirname, '../public/icon/securefox-icon.svg');
const outputDir = path.join(__dirname, '../public/icon');

async function generateIcons() {
  try {
    // 确保输出目录存在
    await fs.mkdir(outputDir, { recursive: true });
    
    // 读取SVG文件
    const svgBuffer = await fs.readFile(inputSvg);
    
    // 生成每个尺寸的PNG
    for (const size of sizes) {
      const outputPath = path.join(outputDir, `${size}.png`);
      
      await sharp(svgBuffer)
        .resize(size, size, {
          fit: 'contain',
          background: { r: 0, g: 0, b: 0, alpha: 0 }
        })
        .png({
          quality: 100,
          compressionLevel: 9
        })
        .toFile(outputPath);
      
      console.log(`✅ Generated ${size}x${size} icon: ${outputPath}`);
    }
    
    console.log('\n🎉 All icons generated successfully!');
    
  } catch (error) {
    console.error('❌ Error generating icons:', error);
    process.exit(1);
  }
}

// 运行生成器
generateIcons();