// Iconos y splash nativos de Atalaya (Fase 5).
//   npm run assets
// 1. Dibuja las fuentes en assets/ con el SVG del ojo y el texto "Atalaya" en trazos.
// 2. Corre @capacitor/assets para Android (iconos, icono adaptativo y splash).
// 3. Añade la capa monocromática del icono adaptativo (Android 13+), que @capacitor/assets no genera.
import { spawnSync } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const assetsDir = join(root, 'assets');
const resDir = join(root, 'android', 'app', 'src', 'main', 'res');

const CREAM = '#FFF3EA';
const INK = '#1A0A03';
const BG = '#0B0604';
const ICON = 1024;
const SPLASH = 2732;
/** El ojo (viewBox de 100) ocupa el 66 % central del icono. */
const EYE_SHARE = 0.66;

/** Ojo de vigía (Fase 5 del prompt, igual que <app-logo>), en un viewBox de 100. */
const eye = (color) => `
  <path d="M6 52c13-22 28-32 44-32s31 10 44 32c-13 22-28 32-44 32S19 74 6 52z" fill="none" stroke="${color}" stroke-width="5.5" stroke-linejoin="round"/>
  <circle cx="50" cy="52" r="25" fill="none" stroke="${color}" stroke-width="2.5" opacity="0.4"/>
  <g transform="translate(32.6 38.2) scale(1.45)"><path d="M12 2.5c.8 3.6 5.2 5.4 5.2 10a5.2 5.2 0 0 1-10.4 0c0-2 .9-3.3 2.1-4.3.1 1.9.9 2.9 2 3.3-.3-3 0-6.2 1.1-9z" fill="${color}"/></g>`;

/** Ojo centrado en un lienzo cuadrado; su centro visual es (50, 52). */
function centeredEye(size, color) {
  const scale = (size * EYE_SHARE) / 100;
  return `<g transform="translate(${size / 2 - 50 * scale} ${size / 2 - 52 * scale}) scale(${scale})">${eye(color)}</g>`;
}

/** CSS linear-gradient(145deg, #FF9A3D, #C8360F) sobre un cuadrado. */
function emberGradient(size) {
  const rad = (145 * Math.PI) / 180;
  const [dx, dy] = [Math.sin(rad), -Math.cos(rad)];
  const half = (size * (Math.abs(dx) + Math.abs(dy))) / 2;
  const c = size / 2;
  return `<defs><linearGradient id="g" gradientUnits="userSpaceOnUse" x1="${c - dx * half}" y1="${c - dy * half}" x2="${c + dx * half}" y2="${c + dy * half}">
    <stop offset="0" stop-color="#FF9A3D"/><stop offset="1" stop-color="#C8360F"/></linearGradient></defs>
  <rect width="${size}" height="${size}" fill="url(#g)"/>`;
}

/**
 * Logo horizontal centrado, con las medidas de logo.css: ojo de 1.42em, separación de 0.33em,
 * texto de 3.426em (Manrope 800, -0.041em) y su línea de 1em centrada con el ojo.
 */
function horizontalLogo(cx, cy, fontSize, color, wordPath) {
  const em = fontSize;
  const eyeSize = 1.42 * em;
  const left = cx - ((1.42 + 0.33 + 3.426) * em) / 2;
  const baseline = cy - em / 2 + 0.883 * em;
  return `<g transform="translate(${left} ${cy - eyeSize / 2}) scale(${eyeSize / 100})">${eye(color)}</g>
  <path transform="translate(${left + eyeSize + 0.33 * em} ${baseline}) scale(${em / 100})" d="${wordPath}" fill="${color}"/>`;
}

const svg = (size, body) => Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">${body}</svg>`);
const toPng = (size, body, file) => sharp(svg(size, body)).png().toFile(join(assetsDir, file));

async function renderSources() {
  await mkdir(assetsDir, { recursive: true });
  const wordmark = await readFile(join(root, 'scripts', 'brand', 'atalaya-wordmark.svg'), 'utf8');
  const wordPath = /<path d="([^"]+)"/.exec(wordmark)[1];
  // Splash cuadrada de 2732: Android la recorta al centro, así que el logo ocupa ~37 % del ancho.
  const splash = `<rect width="${SPLASH}" height="${SPLASH}" fill="${BG}"/>${horizontalLogo(SPLASH / 2, SPLASH / 2, 195, CREAM, wordPath)}`;
  await Promise.all([
    toPng(ICON, emberGradient(ICON) + centeredEye(ICON, CREAM), 'icon-only.png'),
    // @capacitor/assets mete foreground y fondo en un <inset> de 16.7 %: cada imagen equivale al área
    // visible del icono (72 dp), así que el ojo del 66 % queda dentro de la zona segura de todas las máscaras.
    toPng(ICON, centeredEye(ICON, CREAM), 'icon-foreground.png'),
    toPng(ICON, emberGradient(ICON), 'icon-background.png'),
    toPng(ICON, `<rect width="${ICON}" height="${ICON}" fill="${CREAM}"/>` + centeredEye(ICON, INK), 'icon-monochrome.png'),
    toPng(SPLASH, splash, 'splash.png'),
    toPng(SPLASH, splash, 'splash-dark.png'),
  ]);
}

function runCapacitorAssets() {
  const result = spawnSync('npx capacitor-assets generate --android', { cwd: root, stdio: 'inherit', shell: true });
  if (result.status !== 0) throw new Error('capacitor-assets falló');
}

/** Densidades del icono adaptativo (108 dp) que también genera @capacitor/assets. */
const ADAPTIVE_SIZES = { ldpi: 81, mdpi: 108, hdpi: 162, xhdpi: 216, xxhdpi: 324, xxxhdpi: 432 };
const MONOCHROME_LAYER = `
    <monochrome>
        <inset android:drawable="@mipmap/ic_launcher_monochrome" android:inset="16.7%" />
    </monochrome>`;

/**
 * Android solo usa el alfa de la capa monocromática y la tiñe con el tema, así que se dibuja el ojo
 * sobre transparente (icon-monochrome.png, con fondo crema, es la vista previa de cómo se ve).
 */
async function addMonochromeLayer() {
  await Promise.all(
    Object.entries(ADAPTIVE_SIZES).map(([density, size]) =>
      sharp(svg(ICON, centeredEye(ICON, '#000')))
        .resize(size, size)
        .png()
        .toFile(join(resDir, `mipmap-${density}`, 'ic_launcher_monochrome.png')),
    ),
  );
  for (const name of ['ic_launcher.xml', 'ic_launcher_round.xml']) {
    const file = join(resDir, 'mipmap-anydpi-v26', name);
    const xml = await readFile(file, 'utf8');
    if (!xml.includes('<monochrome>')) await writeFile(file, xml.replace(/\s*<\/adaptive-icon>/, `${MONOCHROME_LAYER}\n</adaptive-icon>`));
  }
}

await renderSources();
runCapacitorAssets();
await addMonochromeLayer();
