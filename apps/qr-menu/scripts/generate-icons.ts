import sharp from "sharp";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";

const OUT_DIR = join(process.cwd(), "public", "icons");
const BG = "#0A0A0A";
const FG = "#FAFAFA";

// Build a flat brutalist "Q" wordmark on a black square, monospace-ish.
// The maskable variant shrinks the glyph so Android's adaptive mask never
// crops into the letter.
function svg(size: number, safeZonePct: number): string {
  const inner = Math.floor(size * (1 - safeZonePct * 2));
  const offset = Math.floor(size * safeZonePct);
  // Render glyph at ~72% of the inner square — room for the tail of the Q.
  const fontSize = Math.floor(inner * 0.82);
  // Slight y-nudge because "Q" sits visually low without it.
  const cy = offset + Math.floor(inner / 2) + Math.floor(fontSize * 0.08);
  const cx = offset + Math.floor(inner / 2);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect width="${size}" height="${size}" fill="${BG}"/>
  <text x="${cx}" y="${cy}"
        font-family="'Space Mono', 'Courier New', monospace"
        font-size="${fontSize}"
        font-weight="700"
        fill="${FG}"
        text-anchor="middle"
        dominant-baseline="central">Q</text>
</svg>`;
}

async function render(size: number, safeZonePct: number, filename: string) {
  const buf = Buffer.from(svg(size, safeZonePct));
  const out = join(OUT_DIR, filename);
  await sharp(buf).png().toFile(out);
  console.log(`✓ ${filename}`);
}

// Tiny solid glyph for the monochrome "badge" Android shows in the status bar.
function badgeSvg(size: number): string {
  // Android badges must be white-on-transparent; the OS tints them.
  const cx = size / 2;
  const cy = size / 2 + size * 0.06;
  const fontSize = Math.floor(size * 0.78);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <text x="${cx}" y="${cy}"
        font-family="'Space Mono', 'Courier New', monospace"
        font-size="${fontSize}"
        font-weight="700"
        fill="#FFFFFF"
        text-anchor="middle"
        dominant-baseline="central">Q</text>
</svg>`;
}

async function renderBadge(size: number, filename: string) {
  const buf = Buffer.from(badgeSvg(size));
  const out = join(OUT_DIR, filename);
  await sharp(buf).png().toFile(out);
  console.log(`✓ ${filename}`);
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true });
  // Regular icons: no safe-zone — the glyph fills the whole tile.
  await render(192, 0.08, "icon-192.png");
  await render(512, 0.08, "icon-512.png");
  // Maskable: 10% safe-zone margin so adaptive masks don't crop the letter.
  await render(192, 0.18, "icon-192-maskable.png");
  await render(512, 0.18, "icon-512-maskable.png");
  // iOS home-screen icon — no safe-zone; iOS rounds corners itself.
  const apple = join(process.cwd(), "public", "apple-touch-icon.png");
  await sharp(Buffer.from(svg(180, 0.1))).png().toFile(apple);
  console.log(`✓ apple-touch-icon.png`);
  // Android status-bar badge.
  await renderBadge(72, "badge-72.png");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
