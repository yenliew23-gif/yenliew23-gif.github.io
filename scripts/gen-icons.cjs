// Generate PNG icons from icon.svg using sharp (already a Next.js dep).
// Run with: node scripts/gen-icons.cjs
const fs = require("fs");
const path = require("path");
const sharp = require("sharp");

const ROOT = path.join(__dirname, "..");
const SVG = fs.readFileSync(path.join(ROOT, "public", "icon.svg"));
const MASKABLE = fs.readFileSync(path.join(ROOT, "public", "icon-maskable.svg"));

async function main() {
  const targets = [
    { input: SVG, out: "apple-touch-icon.png", size: 180 },
    { input: SVG, out: "icon-192.png", size: 192 },
    { input: MASKABLE, out: "icon-maskable-192.png", size: 192 },
    { input: SVG, out: "icon-512.png", size: 512 },
    { input: MASKABLE, out: "icon-maskable-512.png", size: 512 },
  ];
  for (const t of targets) {
    const outPath = path.join(ROOT, "public", t.out);
    await sharp(t.input).resize(t.size, t.size).png().toFile(outPath);
    console.log("wrote", t.out, `(${t.size}x${t.size})`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
