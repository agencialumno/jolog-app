// Gera os PNGs-fonte de icone/splash a partir de static/logo.png (simbolo "J").
// Uso: node scripts/make-brand-assets.mjs && bunx capacitor-assets generate
import sharp from 'sharp';
import { mkdirSync } from 'node:fs';

mkdirSync('assets', { recursive: true });
const WHITE = { r: 255, g: 255, b: 255 };
// Regiao do simbolo "J" no logo 1080x1080 (sem o texto "GRUPO JOLOG").
const symbol = await sharp('static/logo.png')
	.extract({ left: 200, top: 60, width: 640, height: 700 })
	.flatten({ background: WHITE })
	.toBuffer();

async function canvas(size, ratio, file) {
	const h = Math.round(size * ratio);
	const inner = await sharp(symbol).resize({ height: h }).toBuffer();
	await sharp({ create: { width: size, height: size, channels: 3, background: WHITE } })
		.composite([{ input: inner, gravity: 'center' }])
		.removeAlpha()
		.png()
		.toFile(file);
}

await canvas(1024, 0.72, 'assets/icon-only.png'); // iOS 1024x1024, sem alfa
await canvas(1024, 0.55, 'assets/icon-foreground.png'); // zona segura do adaptive icon
await sharp({ create: { width: 1024, height: 1024, channels: 3, background: WHITE } }).png().toFile('assets/icon-background.png');
await canvas(2732, 0.28, 'assets/splash.png');
await canvas(2732, 0.28, 'assets/splash-dark.png');
console.log('ok');
