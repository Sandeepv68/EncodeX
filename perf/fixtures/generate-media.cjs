/**
 * @fileoverview Generate test media fixtures using ffmpeg-static.
 * Run: node perf/fixtures/generate-media.mjs
 */

const { spawn } = require('child_process');
const { existsSync, mkdirSync, readdirSync } = require('fs');
const { join } = require('path');

const ffmpegPath = (() => {
  try { return require('ffmpeg-static'); } catch { return 'ffmpeg'; }
})();
const OUTPUT_DIR = join(process.cwd(), 'perf', 'fixtures');

function generateClip(name, duration, width, height) {
  return new Promise((res, rej) => {
    const output = join(OUTPUT_DIR, `${name}.mp4`);
    if (existsSync(output)) {
      console.log(`  [SKIP] ${name}.mp4 (exists)`);
      return res();
    }

    console.log(`  [GEN] ${name}.mp4 (${width}x${height}, ${duration}s)`);
    const proc = spawn(ffmpegPath, [
      '-y', '-hide_banner', '-loglevel', 'error',
      '-f', 'lavfi', '-i', `testsrc=duration=${duration}:size=${width}x${height}:rate=30`,
      '-f', 'lavfi', '-i', 'sine=frequency=440:duration=' + duration,
      '-c:v', 'libx264', '-preset', 'ultrafast', '-pix_fmt', 'yuv420p',
      '-c:a', 'aac', '-b:a', '128k',
      output,
    ], { stdio: ['ignore', 'ignore', 'pipe'] });

    proc.on('close', (code) => {
      if (code === 0) res();
      else rej(new Error(`FFmpeg exited with code ${code}`));
    });
    proc.on('error', rej);
  });
}

async function main() {
  console.log('=== Generating test media fixtures ===');
  console.log('  Output dir:', OUTPUT_DIR);
  console.log('');

  mkdirSync(OUTPUT_DIR, { recursive: true });

  await generateClip('test-5s-480p', 5, 854, 480);
  await generateClip('test-5s-720p', 5, 1280, 720);
  await generateClip('test-5s-1080p', 5, 1920, 1080);
  await generateClip('test-10s-1080p', 10, 1920, 1080);
  await generateClip('test-30s-1080p', 30, 1920, 1080);
  await generateClip('test-300s-1080p', 300, 1920, 1080);

  for (let i = 1; i <= 20; i++) {
    await generateClip(`batch-${i}`, 3, 640, 360);
  }

  const count = readdirSync(OUTPUT_DIR).filter((f) => f.endsWith('.mp4')).length;
  console.log('');
  console.log(`=== Done === (${count} fixtures)`);
}

main().catch((err) => {
  console.error('Failed:', err);
  process.exit(1);
});
