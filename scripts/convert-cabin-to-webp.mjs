/**
 * Converts the cabin SVG background to WebP for fast loading.
 * Generates cabin-desktop.webp (1400px, q88) — used for both mobile and desktop.
 * Run: node scripts/convert-cabin-to-webp.mjs  or  npm run convert-cabin
 */

import sharp from "sharp";
import { fileURLToPath } from "node:url";
import path from "node:path";
import fs from "node:fs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const PUBLIC = path.join(ROOT, "public");

const SOURCE = path.join(PUBLIC, "cabin_2.svg");
const CROP_TOP = 50;
const CROP_HEIGHT = 2750;
const SOURCE_WIDTH = 1063;

const DESKTOP_WIDTH = 1400;
const DESKTOP_QUALITY = 88;

async function main() {
  if (!fs.existsSync(SOURCE)) {
    console.error("Source not found:", SOURCE);
    process.exit(1);
  }

  console.log("Rasterizing SVG (this may take a moment for large files)...");
  const full = await sharp(SOURCE)
    .resize(SOURCE_WIDTH)
    .toBuffer();

  const meta = await sharp(full).metadata();
  const fullHeight = meta.height || Math.round(3792);
  const cropTopPx = Math.round((CROP_TOP / 3792) * fullHeight);
  const cropHeightPx = Math.round((CROP_HEIGHT / 3792) * fullHeight);

  const cropped = await sharp(full)
    .extract({
      left: 0,
      top: cropTopPx,
      width: SOURCE_WIDTH,
      height: Math.min(cropHeightPx, fullHeight - cropTopPx),
    })
    .toBuffer();

  console.log("Writing cabin-desktop.webp (1400px, q88)...");
  await sharp(cropped)
    .resize(DESKTOP_WIDTH)
    .webp({ quality: DESKTOP_QUALITY })
    .toFile(path.join(PUBLIC, "cabin-desktop.webp"));

  console.log("Done.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
