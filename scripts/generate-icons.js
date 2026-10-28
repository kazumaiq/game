import puppeteer from 'puppeteer-core';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, '..');
const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

async function generateIcons() {
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  const page = await browser.newPage();

  const svgHtml = (size) => `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
          width: ${size}px;
          height: ${size}px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: #090c10;
          overflow: hidden;
        }
      </style>
    </head>
    <body>
      <svg width="${size}" height="${size}" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#1e293b"/>
            <stop offset="50%" stop-color="#0f172a"/>
            <stop offset="100%" stop-color="#0284c7"/>
          </linearGradient>
          <linearGradient id="foamGrad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stop-color="#38bdf8"/>
            <stop offset="100%" stop-color="#0284c7"/>
          </linearGradient>
          <linearGradient id="carGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#f8fafc"/>
            <stop offset="100%" stop-color="#cbd5e1"/>
          </linearGradient>
          <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="12" result="blur"/>
            <feComposite in="SourceGraphic" in2="blur" operator="over"/>
          </filter>
        </defs>

        <!-- Rounded Background -->
        <rect x="24" y="24" width="464" height="464" rx="96" fill="url(#bg)" stroke="#38bdf8" stroke-width="8" stroke-opacity="0.4"/>

        <!-- Glow ring -->
        <circle cx="256" cy="240" r="150" fill="none" stroke="#38bdf8" stroke-width="4" stroke-opacity="0.2" filter="url(#glow)"/>

        <!-- Water Drop / Spray Arch -->
        <path d="M 170 140 C 210 90, 302 90, 342 140" fill="none" stroke="#38bdf8" stroke-width="14" stroke-linecap="round" stroke-dasharray="8 16"/>

        <!-- Car Silhouette -->
        <g transform="translate(106, 175)">
          <!-- Car roof & windshield -->
          <path d="M 60 85 L 90 25 C 95 15, 110 10, 125 10 L 175 10 C 190 10, 205 15, 210 25 L 240 85 Z" fill="#64748b"/>
          <path d="M 72 80 L 98 28 C 102 20, 112 16, 125 16 L 175 16 C 188 16, 198 20, 202 28 L 228 80 Z" fill="#38bdf8" fill-opacity="0.85"/>

          <!-- Car Body -->
          <rect x="15" y="80" width="270" height="60" rx="16" fill="url(#carGrad)"/>

          <!-- Headlights -->
          <rect x="268" y="90" width="16" height="18" rx="4" fill="#38bdf8" filter="url(#glow)"/>
          <rect x="16" y="90" width="14" height="18" rx="4" fill="#ef4444"/>

          <!-- Wheels -->
          <circle cx="70" cy="140" r="26" fill="#1e293b" stroke="#64748b" stroke-width="8"/>
          <circle cx="70" cy="140" r="10" fill="#94a3b8"/>

          <circle cx="230" cy="140" r="26" fill="#1e293b" stroke="#64748b" stroke-width="8"/>
          <circle cx="230" cy="140" r="10" fill="#94a3b8"/>
        </g>

        <!-- Water Bubbles / Foam Drops -->
        <circle cx="160" cy="120" r="14" fill="#38bdf8" fill-opacity="0.75"/>
        <circle cx="256" cy="90" r="18" fill="#e0f2fe" fill-opacity="0.9"/>
        <circle cx="350" cy="125" r="12" fill="#38bdf8" fill-opacity="0.8"/>
        <circle cx="380" cy="190" r="16" fill="#7dd3fc" fill-opacity="0.7"/>
        <circle cx="130" cy="200" r="10" fill="#bae6fd" fill-opacity="0.8"/>

        <!-- Text Brand Accent -->
        <text x="256" y="415" text-anchor="middle" font-family="system-ui, -apple-system, sans-serif" font-size="34" font-weight="800" fill="#f8fafc" letter-spacing="2">
          АВТОМОЙКА
        </text>
        <text x="256" y="445" text-anchor="middle" font-family="system-ui, -apple-system, sans-serif" font-size="18" font-weight="600" fill="#38bdf8" letter-spacing="4">
          CXRNER SIM
        </text>
      </svg>
    </body>
    </html>
  `;

  for (const size of [192, 512]) {
    await page.setViewport({ width: size, height: size });
    await page.setContent(svgHtml(size));
    const outPath = path.resolve(ROOT_DIR, 'public', `icon-${size}.png`);
    await page.screenshot({ path: outPath, omitBackground: true });
    console.log(`Generated: ${outPath} (${size}x${size})`);
  }

  // Also generate standard favicon.png
  await page.setViewport({ width: 64, height: 64 });
  await page.setContent(svgHtml(64));
  await page.screenshot({ path: path.resolve(ROOT_DIR, 'public', 'favicon.png'), omitBackground: true });
  console.log('Generated: public/favicon.png (64x64)');

  await browser.close();
}

generateIcons().catch(err => {
  console.error(err);
  process.exit(1);
});
