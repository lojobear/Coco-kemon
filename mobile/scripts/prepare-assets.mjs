import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const root = path.resolve(import.meta.dirname, '..');
const repoRoot = path.resolve(root, '..');
const assets = path.join(root, 'assets');
const iconSource = path.join(repoRoot, 'public', 'icon.svg');

await fs.rm(assets, { recursive: true, force: true });
await fs.mkdir(assets, { recursive: true });

const icon = await sharp(iconSource).resize(1024, 1024).png().toBuffer();
await fs.writeFile(path.join(assets, 'icon.png'), icon);

const splashIcon = await sharp(iconSource).resize(760, 760).png().toBuffer();
await sharp({
  create: {
    width: 2732,
    height: 2732,
    channels: 4,
    background: '#ffffff',
  },
})
  .composite([{ input: splashIcon, gravity: 'centre' }])
  .png()
  .toFile(path.join(assets, 'splash.png'));

const darkSplashIcon = await sharp(iconSource).resize(760, 760).png().toBuffer();
await sharp({
  create: {
    width: 2732,
    height: 2732,
    channels: 4,
    background: '#111111',
  },
})
  .composite([{ input: darkSplashIcon, gravity: 'centre' }])
  .png()
  .toFile(path.join(assets, 'splash-dark.png'));

console.log('Prepared QuarkPop Android icon and splash assets.');
