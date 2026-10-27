/**
 * @fileoverview Generates the desktop installer icons (`icon.ico`, `icon.icns`)
 * from the master PNG.
 *
 * electron-builder needs a real `.ico` for Windows and a real `.icns` for
 * macOS. Pointing both at a PNG produced default Electron icons in the
 * installers, which is why the packaging config now names the generated
 * files instead.
 *
 * The resize is done with Electron's `nativeImage`, so the project needs no
 * image-processing dependency: Electron is already a build-time dependency
 * and its scaler is the same one the app itself renders icons with.
 *
 * Usage:
 *     npx electron scripts/generate-desktop-icons.mjs
 *
 * The generated files are committed, so a normal build never has to run this.
 */

import { app, nativeImage } from 'electron';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');

/** The master icon every platform icon is derived from. */
const SOURCE = path.join(root, 'assets', 'icons', 'AppIcon.icon', 'Assets', 'icon.png');

/** Where the generated files are written. */
const ICO_OUT = path.join(root, 'assets', 'icons', 'icon.ico');
const ICNS_OUT = path.join(root, 'assets', 'icons', 'icon.icns');

/**
 * Icon sizes Windows wants in the `.ico`.
 *
 * 256 is the size the shell shows at large scale, 16 the smallest one the
 * Explorer list view uses; the middle sizes are what the taskbar and the
 * Alt+Tab switcher ask for.
 */
const ICO_SIZES = [16, 24, 32, 48, 64, 128, 256];

/**
 * The `icns` entries to write, as `[OSType, pixelSize]`.
 *
 * These are the types `iconutil` produces for an `.iconset`. Each one is a
 * PNG payload, which every macOS version EncodeX supports reads.
 */
const ICNS_ENTRIES = [
  ['icp4', 16],
  ['icp5', 32],
  ['icp6', 64],
  ['ic07', 128],
  ['ic08', 256],
  ['ic09', 512],
  ['ic10', 1024],
  ['ic11', 32],
  ['ic12', 64],
  ['ic13', 256],
  ['ic14', 512],
];

/**
 * Renders the source icon at a given square size.
 *
 * @param {number} size - The edge length in pixels.
 * @returns {Buffer} The PNG bytes.
 */
function renderPng(size) {
  const image = nativeImage.createFromPath(SOURCE);
  if (image.isEmpty()) {
    throw new Error(`Could not read the source icon at ${SOURCE}`);
  }
  const resized = image.resize({ width: size, height: size, quality: 'best' });
  const png = resized.toPNG();
  if (png.length === 0) {
    throw new Error(`Could not encode the icon at ${size}x${size}`);
  }
  return png;
}

/**
 * Builds an ICO file containing PNG-compressed entries.
 *
 * PNG-in-ICO is what Windows Vista and later use, and it is the only format
 * that keeps a 256x256 entry small.
 *
 * @param {number[]} sizes - The sizes to include.
 * @returns {Buffer} The `.ico` bytes.
 */
function buildIco(sizes) {
  const images = sizes.map((size) => renderPng(size));

  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // type: icon
  header.writeUInt16LE(images.length, 4);

  const entries = [];
  let offset = header.length + images.length * 16;

  for (let index = 0; index < images.length; index += 1) {
    const size = sizes[index];
    const image = images[index];
    const entry = Buffer.alloc(16);
    entry.writeUInt8(size >= 256 ? 0 : size, 0); // width, 0 means 256
    entry.writeUInt8(size >= 256 ? 0 : size, 1); // height, 0 means 256
    entry.writeUInt8(0, 2); // palette size
    entry.writeUInt8(0, 3); // reserved
    entry.writeUInt16LE(1, 4); // color planes
    entry.writeUInt16LE(32, 6); // bits per pixel
    entry.writeUInt32LE(image.length, 8);
    entry.writeUInt32LE(offset, 12);
    entries.push(entry);
    offset += image.length;
  }

  return Buffer.concat([header, ...entries, ...images]);
}

/**
 * Builds an ICNS file containing PNG entries.
 *
 * The container is a magic string, the total length, then a sequence of
 * length-prefixed entries. Every entry's length covers its own 8-byte header.
 *
 * @param {Array<[string, number]>} types - The `[OSType, pixelSize]` entries.
 * @returns {Buffer} The `.icns` bytes.
 */
function buildIcns(types) {
  const chunks = types.map(([type, size]) => {
    const payload = renderPng(size);
    const header = Buffer.alloc(8);
    header.write(type, 0, 4, 'ascii');
    header.writeUInt32BE(payload.length + header.length, 4);
    return Buffer.concat([header, payload]);
  });

  const body = Buffer.concat(chunks);
  const file = Buffer.alloc(8);
  file.write('icns', 0, 4, 'ascii');
  file.writeUInt32BE(body.length + file.length, 4);
  return Buffer.concat([file, body]);
}

app.whenReady().then(() => {
  if (!fs.existsSync(SOURCE)) {
    console.error(`Missing source icon: ${SOURCE}`);
    app.exit(1);
    return;
  }

  fs.writeFileSync(ICO_OUT, buildIco(ICO_SIZES));
  fs.writeFileSync(ICNS_OUT, buildIcns(ICNS_ENTRIES));

  console.log(`Wrote ${path.relative(root, ICO_OUT)} (${fs.statSync(ICO_OUT).size} bytes)`);
  console.log(`Wrote ${path.relative(root, ICNS_OUT)} (${fs.statSync(ICNS_OUT).size} bytes)`);
  app.exit(0);
});
