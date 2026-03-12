import { dirname, join } from 'path';
import sharp from 'sharp';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const staticDir = join(__dirname, '..', 'static');

const size = 192;
await sharp({
	create: {
		width: size,
		height: size,
		channels: 4,
		background: { r: 79, g: 70, b: 229, alpha: 1 }
	}
})
	.png()
	.toFile(join(staticDir, 'pwa-192x192.png'));

const size512 = 512;
await sharp({
	create: {
		width: size512,
		height: size512,
		channels: 4,
		background: { r: 79, g: 70, b: 229, alpha: 1 }
	}
})
	.png()
	.toFile(join(staticDir, 'pwa-512x512.png'));

console.log('Icons generated successfully!');
