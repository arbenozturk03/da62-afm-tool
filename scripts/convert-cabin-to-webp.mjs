/**
 * Converts the cabin SVG background to WebP for fast loading.
 * Generates responsive versions: cabin-mobile.webp (900px, q70), cabin-desktop.webp (1400px, q75).
 * Run: node scripts/convert-cabin-to-webp.mjs
 * Optional: npm run convert-cabin (add to package.json scripts)
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

const MOBILE_WIDTH = 900;
const MOBILE_QUALITY = 70;
const DESKTOP_WIDTH = 1400;
const DESKTOP_QUALITY = 75;

async function main() {
  if (!fs.existsSync(SOURCE)) {
    console.error("Source not found:", SOURCE);
    process.exit(1);
  }

  console.log("Rasterizing SVG (this may take a moment for large files)...");
  const full = await sharp(SOURCE)
    .resize(SOURCE_WIDTH) // height auto by aspect ratio
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

  console.log("Writing cabin-mobile.webp (900px, q70)...");
  await sharp(cropped)
    .resize(MOBILE_WIDTH)
    .webp({ quality: MOBILE_QUALITY })
    .toFile(path.join(PUBLIC, "cabin-mobile.webp"));

  console.log("Writing cabin-desktop.webp (1400px, q75)...");
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
