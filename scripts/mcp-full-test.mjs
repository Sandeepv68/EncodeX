#!/usr/bin/env node

import fs from 'fs';
import http from 'http';
import os from 'os';
import path from 'path';
import { spawn, spawnSync } from 'child_process';
import { fileURLToPath } from 'url';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import ffmpegStatic from 'ffmpeg-static';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIST_MCP_STDIO = path.join(ROOT, 'dist', 'mcp', 'index.js');
const DIST_MCP_HTTP = path.join(ROOT, 'dist', 'mcp', 'http-server.js');
const DIST_MAIN = path.join(ROOT, 'dist', 'main', 'index.js');
const DIST_PRELOAD = path.join(ROOT, 'dist', 'preload', 'index.js');
const DIST_RENDERER = path.join(ROOT, 'dist', 'renderer', 'index.html');
const VSCODE_MCP_JSON = path.join(ROOT, '.vscode', 'mcp.json');
const APP_USER_DATA_DIR = 'EncodeX';
const MCP_SETTINGS_FILE = 'mcp-settings.json';
const HTTP_TOKEN = 'encodex-full-test-token';

const CORE_TOOLS = [
  'ping',
  'convert_media',
  'get_job',
  'list_jobs',
  'cancel_job',
  'get_media_info',
  'list_capabilities',
  'list_profiles',
  'get_profile',
  'compress_image',
  'extract_audio',
  'cut_video',
  'batch_convert',
  'remux_media',
  'demux_media',
];
const GUI_TOOLS = ['get_queue_state', 'cancel_all_jobs', 'get_timeline', 'extract_preview', 'get_system_info', 'check_for_updates'];
const ALL_TOOLS = [...CORE_TOOLS, ...GUI_TOOLS];
const RESOURCE_URIS = ['encodex://profiles', 'encodex://capabilities', 'encodex://codecs'];
const PROMPT_NAMES = ['convert-video', 'extract-audio', 'compress-image', 'batch-convert'];

let section = 'setup';
let lastHeader = '';
const results = [];
const cleanups = [];

function openSection(title) {
  section = title;
  if (lastHeader !== title) {
    console.log(`\n== ${title} ==`);
    lastHeader = title;
  }
}

function onceCleanup(fn) {
  let ran = false;
  const wrapped = async () => {
    if (ran) return;
    ran = true;
    await fn();
  };
  cleanups.push(wrapped);
  return wrapped;
}

async function runCleanups() {
  for (const fn of [...cleanups].reverse()) {
    try {
      await fn();
    } catch {}
  }
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function warn(message) {
  results.push({ section, name: message, status: 'warn' });
  console.log(`  WARN [${section}] ${message}`);
}

async function check(name, fn) {
  try {
    await fn();
    results.push({ section, name, status: 'pass' });
    console.log(`  PASS [${section}] ${name}`);
    return true;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    results.push({ section, name, status: 'fail', message });
    console.error(`  FAIL [${section}] ${name} - ${message}`);
    return false;
  }
}

async function waitFor(fn, { timeout = 30000, interval = 200 } = {}) {
  const deadline = Date.now() + timeout;
  let lastError;
  while (Date.now() < deadline) {
    try {
      await fn();
      return;
    } catch (error) {
      lastError = error;
      await sleep(interval);
    }
  }
  const detail = lastError instanceof Error ? lastError.message : String(lastError ?? 'condition not met');
  throw new Error(`timed out after ${timeout}ms: ${detail}`);
}

function toolText(result) {
  const blocks = (result.content ?? []).filter((block) => block.type === 'text');
  return blocks.map((block) => block.text ?? '').join('');
}

async function callToolRaw(client, name, args) {
  const result = await client.callTool({ name, arguments: args });
  return JSON.parse(toolText(result));
}

async function callTool(client, name, args) {
  const parsed = await callToolRaw(client, name, args);
  if (parsed.ok === false) {
    throw new Error(`${name} failed: ${parsed.code ?? 'unknown'}: ${parsed.message ?? ''}`);
  }
  return parsed;
}

async function waitDone(client, jobId, timeout = 30000) {
  let last;
  await waitFor(
    async () => {
      last = await callTool(client, 'get_job', { jobId });
      assert(last.status === 'done', `status=${last.status}`);
    },
    { timeout },
  );
  return last;
}

function runFfmpeg(args) {
  return new Promise((resolve, reject) => {
    const proc = spawn(ffmpegStatic, ['-y', '-hide_banner', '-loglevel', 'error', ...args], {
      stdio: ['ignore', 'ignore', 'pipe'],
    });
    let err = '';
    proc.stderr.on('data', (chunk) => (err += chunk.toString()));
    proc.on('close', (code) => (code === 0 ? resolve() : reject(new Error(`ffmpeg exited ${code}: ${err.slice(-400)}`))));
    proc.on('error', reject);
  });
}

async function prepareFixtures(dir) {
  const clip = (name, duration, extra = []) =>
    runFfmpeg([
      '-f',
      'lavfi',
      '-i',
      `testsrc=duration=${duration}:size=160x90:rate=10`,
      '-f',
      'lavfi',
      '-i',
      `sine=frequency=440:duration=${duration}`,
      '-shortest',
      '-c:v',
      'libx264',
      '-preset',
      'ultrafast',
      '-pix_fmt',
      'yuv420p',
      '-c:a',
      'aac',
      '-b:a',
      '96k',
      ...extra,
      path.join(dir, name),
    ]);

  await clip('a.mp4', 1);
  await clip('b.mp4', 2);
  await runFfmpeg(['-f', 'lavfi', '-i', 'testsrc=duration=0.4:size=96x54:rate=5', '-frames:v', '1', path.join(dir, 'pic.jpg')]);
  await runFfmpeg([
    '-f',
    'lavfi',
    '-i',
    'testsrc=duration=30:size=640x360:rate=25',
    '-c:v',
    'libx264',
    '-preset',
    'ultrafast',
    '-pix_fmt',
    'yuv420p',
    '-an',
    path.join(dir, 'long.mp4'),
  ]);
  fs.writeFileSync(path.join(dir, 'forced.srt'), '1\n00:00:00,000 --> 00:00:00,500\nmcp full test\n\n');
  fs.writeFileSync(path.join(dir, 'meta.txt'), ';FFMETADATA1\n\n[CHAPTER]\nTIMEBASE=1/1000\nSTART=0\nEND=500\ntitle=Opening\n');
  return {
    dir,
    video: path.join(dir, 'a.mp4'),
    video2: path.join(dir, 'b.mp4'),
    long: path.join(dir, 'long.mp4'),
    image: path.join(dir, 'pic.jpg'),
    subtitle: path.join(dir, 'forced.srt'),
    chapters: path.join(dir, 'meta.txt'),
  };
}

function parseArgs() {
  const argv = process.argv.slice(2);
  const known = ['--skip-stdio', '--skip-http', '--skip-gui', '--keep-tmp', '--help', '-h'];
  for (const arg of argv) {
    if (!known.includes(arg)) {
      console.error(`Unknown flag: ${arg}`);
      printUsage();
      process.exit(2);
    }
  }
  if (argv.includes('--help') || argv.includes('-h')) {
    printUsage();
    process.exit(0);
  }
  return {
    stdio: !argv.includes('--skip-stdio'),
    http: !argv.includes('--skip-http'),
    gui: !argv.includes('--skip-gui'),
    keepTmp: argv.includes('--keep-tmp'),
  };
}

function printUsage() {
  console.log(
    [
      'Usage: node scripts/mcp-full-test.mjs [flags]',
      '',
      'Exercises the complete EncodeX MCP surface locally: 15 stdio tools,',
      '15 tools + security over standalone Streamable HTTP, and the 21-tool',
      "embedded server exactly as the repo's .vscode/mcp.json client dials it.",
      '',
      'Flags:',
      '  --skip-stdio   Skip the stdio transport suite',
      '  --skip-http    Skip the standalone HTTP transport suite',
      '  --skip-gui     Skip the embedded (Electron GUI, 21-tool) suite',
      '  --keep-tmp     Keep the generated media fixtures',
      '  -h, --help     Show this help',
    ].join('\n'),
  );
}

function preflight(flags) {
  const missing = [];
  if (flags.stdio && !fs.existsSync(DIST_MCP_STDIO)) missing.push(DIST_MCP_STDIO);
  if (flags.http && !fs.existsSync(DIST_MCP_HTTP)) missing.push(DIST_MCP_HTTP);
  if (flags.gui) {
    for (const artifact of [DIST_MAIN, DIST_PRELOAD, DIST_RENDERER]) {
      if (!fs.existsSync(artifact)) missing.push(artifact);
    }
  }
  if (!ffmpegStatic || !fs.existsSync(ffmpegStatic)) missing.push('ffmpeg-static binary');
  if (missing.length > 0) {
    console.error('[mcp-full-test] Missing build artifacts:');
    for (const item of missing) console.error(`  - ${item}`);
    console.error('[mcp-full-test] Run `npm run build` (or `npm run build:main` + `npm run build:renderer`) first.');
    process.exit(1);
  }
}

async function validateVscodeConfig() {
  openSection('vscode-client-config');
  let raw = null;
  const parsed = await check('.vscode/mcp.json exists and parses', () => {
    assert(fs.existsSync(VSCODE_MCP_JSON), `missing ${VSCODE_MCP_JSON}`);
    raw = JSON.parse(fs.readFileSync(VSCODE_MCP_JSON, 'utf8'));
    assert(raw && typeof raw === 'object', 'root is not a JSON object');
  });
  if (!parsed) {
    warn('falling back to the default endpoint http://127.0.0.1:8765/mcp');
    return { url: 'http://127.0.0.1:8765/mcp', port: 8765, token: '' };
  }
  const hasServer = await check('defines the "encodex" server with type "http"', () => {
    const server = raw.servers && raw.servers.encodex;
    assert(server, 'servers.encodex is missing');
    assert(server.type === 'http', `type is "${server.type}", expected "http"`);
    assert(typeof server.url === 'string', 'server.url is missing');
  });
  if (!hasServer) {
    warn('falling back to the default endpoint http://127.0.0.1:8765/mcp');
    return { url: 'http://127.0.0.1:8765/mcp', port: 8765, token: '' };
  }
  let endpoint = null;
  await check('endpoint is a loopback /mcp URL on a valid port', () => {
    const url = new URL(raw.servers.encodex.url);
    assert(['127.0.0.1', 'localhost', '::1'].includes(url.hostname), `hostname ${url.hostname} is not loopback`);
    assert(url.pathname === '/mcp', `path ${url.pathname} does not match the server route /mcp`);
    const port = Number(url.port || (url.protocol === 'https:' ? 443 : 80));
    assert(port >= 1024 && port <= 65535, `port ${port} is outside 1024-65535`);
    endpoint = { url: url.href, port, token: '' };
  });
  if (!endpoint) {
    warn('falling back to the default endpoint http://127.0.0.1:8765/mcp');
    return { url: 'http://127.0.0.1:8765/mcp', port: 8765, token: '' };
  }
  await check('Authorization header (if any) carries a bearer token', () => {
    const auth = raw.servers.encodex.headers && raw.servers.encodex.headers.Authorization;
    if (auth === undefined) return;
    assert(/^Bearer\s+\S+$/i.test(String(auth)), `malformed Authorization header: ${auth}`);
    endpoint.token = String(auth).replace(/^Bearer\s+/i, '');
  });
  console.log(`  endpoint: ${endpoint.url}${endpoint.token ? ' (bearer auth)' : ' (no auth)'}`);
  return endpoint;
}

async function runCoreSuite(client, fx, { expectedTools, mode, outDir }) {
  await check('handshake advertises tools, resources and prompts', () => {
    const caps = client.getServerCapabilities();
    assert(caps, 'server capabilities missing');
    assert(caps.tools, 'tools capability not advertised');
    assert(caps.resources, 'resources capability not advertised');
    assert(caps.prompts, 'prompts capability not advertised');
    const version = client.getServerVersion();
    assert(version && /encodex/i.test(version.name ?? ''), `unexpected server name: ${version?.name}`);
    assert(/^\d+\.\d+\.\d+/.test(version.version ?? ''), `unexpected server version: ${version?.version}`);
  });

  await check(`tools/list returns exactly ${expectedTools.length} documented tools`, async () => {
    const { tools } = await client.listTools();
    const names = tools.map((tool) => tool.name).sort();
    const expected = [...expectedTools].sort();
    assert(JSON.stringify(names) === JSON.stringify(expected), `got [${names.join(', ')}]`);
    for (const tool of tools) {
      assert(tool.description && tool.description.length > 10, `${tool.name} has no description`);
      assert(tool.inputSchema, `${tool.name} has no inputSchema`);
    }
  });

  await check('ping returns pong', async () => {
    const pong = await callTool(client, 'ping', {});
    assert(pong.pong === true, JSON.stringify(pong));
  });

  await check('list_capabilities reports ffmpeg encoders', async () => {
    const caps = await callTool(client, 'list_capabilities', {});
    assert(caps && typeof caps === 'object', 'capabilities payload is not an object');
    assert(Array.isArray(caps.videoEncoders) && caps.videoEncoders.length > 0, 'no video encoders');
    assert(Array.isArray(caps.audioEncoders) && caps.audioEncoders.length > 0, 'no audio encoders');
    assert(Array.isArray(caps.hwaccels), 'hwaccels missing');
  });

  await check('list_profiles / get_profile round-trip', async () => {
    const profiles = await callTool(client, 'list_profiles', {});
    assert(Array.isArray(profiles) && profiles.length > 0, 'no profiles returned');
    for (const profile of profiles.slice(0, 5)) {
      assert(profile.id && profile.name, `profile missing id/name: ${JSON.stringify(profile)}`);
    }
    const full = await callTool(client, 'get_profile', { profileId: profiles[0].id });
    assert(full.id === profiles[0].id, `get_profile returned ${full.id}`);
    const missing = await callToolRaw(client, 'get_profile', { profileId: 'no-such-profile' });
    assert(missing.ok === false, 'unknown profile should return ok:false');
  });

  await check('get_media_info probes the generated clip', async () => {
    const info = await callTool(client, 'get_media_info', { input: fx.video });
    assert(info.file === fx.video, `file is ${info.file}`);
    assert(Array.isArray(info.streams) && info.streams.length >= 2, `streams: ${info.streams?.length}`);
    const ghost = await callToolRaw(client, 'get_media_info', { input: path.join(fx.dir, 'ghost.mp4') });
    assert(ghost.ok === false, 'missing input should return ok:false');
  });

  const convertStarted = { jobId: null, output: null };
  await check('convert_media runs a real conversion to done', async () => {
    const started = await callTool(client, 'convert_media', {
      input: fx.video,
      output: path.join(outDir, 'converted.mp4'),
      videoCodec: 'libx264',
      qscale: 26,
      audioCodec: 'aac',
      transcoder: 'FFMPEG',
    });
    assert(started.jobId, `no jobId: ${JSON.stringify(started)}`);
    convertStarted.jobId = started.jobId;
    convertStarted.output = started.output;
    const done = await waitDone(client, started.jobId, 45000);
    assert(done.status === 'done', `status ${done.status}`);
    assert(fs.existsSync(started.output) && fs.statSync(started.output).size > 0, `missing output ${started.output}`);
  });

  await check('list_jobs and get_job expose the finished job', async () => {
    const jobs = await callTool(client, 'list_jobs', {});
    assert(Array.isArray(jobs) && jobs.length > 0, 'job list is empty');
    const mine = jobs.find((job) => job.id === convertStarted.jobId);
    assert(mine, `job ${convertStarted.jobId} not listed`);
    const detail = await callTool(client, 'get_job', { jobId: convertStarted.jobId });
    assert(detail.status === 'done', `status ${detail.status}`);
    const ghost = await callToolRaw(client, 'get_job', { jobId: 'no-such-job' });
    assert(ghost.ok === false, 'unknown job should return ok:false');
  });

  if (mode !== 'full') {
    await runResourcesAndPrompts(client);
    return;
  }

  await check('extract_audio drops the video stream', async () => {
    const started = await callTool(client, 'extract_audio', { input: fx.video2, output: path.join(outDir, 'audio.mp3') });
    await waitDone(client, started.jobId, 45000);
    assert(fs.existsSync(started.output) && fs.statSync(started.output).size > 0, `missing output ${started.output}`);
  });

  await check('compress_image writes a webp', async () => {
    const started = await callTool(client, 'compress_image', {
      input: fx.image,
      output: path.join(outDir, 'image.webp'),
      format: 'webp',
      quality: 28,
    });
    await waitDone(client, started.jobId, 45000);
    assert(fs.existsSync(started.output) && fs.statSync(started.output).size > 0, `missing output ${started.output}`);
  });

  await check('cut_video trims via stream copy', async () => {
    const started = await callTool(client, 'cut_video', { input: fx.video, output: path.join(outDir, 'cut.mp4'), duration: '0.4' });
    await waitDone(client, started.jobId, 45000);
    assert(fs.existsSync(started.output) && fs.statSync(started.output).size > 0, `missing output ${started.output}`);
  });

  await check('batch_convert finishes every queued job', async () => {
    const batchDir = path.join(outDir, 'batch');
    const started = await callTool(client, 'batch_convert', {
      inputs: [fx.video, fx.video2],
      outputDir: batchDir,
      videoCodec: 'libvpx-vp9',
      concurrency: 2,
    });
    assert(started.total === 2, `total ${started.total}`);
    assert(fs.existsSync(batchDir), `batch outputDir ${batchDir} was not created`);
    const ids = started.jobs.map((job) => job.jobId);
    await waitFor(
      async () => {
        const jobs = await callTool(client, 'list_jobs', {});
        for (const id of ids) {
          const mine = jobs.find((job) => job.id === id);
          assert(mine && mine.status === 'done', `job ${id} is ${mine?.status ?? 'missing'}`);
        }
      },
      { timeout: 60000 },
    );
    for (const job of started.jobs) {
      assert(fs.existsSync(job.output) && fs.statSync(job.output).size > 0, `missing output ${job.output}`);
    }
  });

  await check('remux_media stream-copies into mkv', async () => {
    const started = await callTool(client, 'remux_media', { input: fx.video, container: 'mkv', output: path.join(outDir, 'remuxed.mkv') });
    assert(started.container === 'mkv', `container ${started.container}`);
    assert(JSON.stringify(started.map) === JSON.stringify(['0:v:0', '0:a:0']), `map ${JSON.stringify(started.map)}`);
    await waitDone(client, started.jobId, 45000);
    assert(fs.existsSync(started.output) && fs.statSync(started.output).size > 0, `missing output ${started.output}`);
  });

  await check('remux_media muxes subtitle, cover art and chapters', async () => {
    const started = await callTool(client, 'remux_media', {
      input: fx.video,
      container: 'mkv',
      output: path.join(outDir, 'remuxed-full.mkv'),
      addSubtitle: [{ file: fx.subtitle, codec: 'srt' }],
      thumbnail: { file: fx.image },
      chapters: { file: fx.chapters },
    });
    await waitDone(client, started.jobId, 45000);
    const info = await callTool(client, 'get_media_info', { input: started.output });
    const kinds = info.streams.map((stream) => stream.type);
    assert(kinds.includes('subtitle'), `no subtitle stream in ${kinds.join(', ')}`);
    assert(kinds.includes('video'), `no video stream in ${kinds.join(', ')}`);
  });

  await check('demux_media extracts one job per stream', async () => {
    const started = await callTool(client, 'demux_media', { input: fx.video2, outputDir: path.join(outDir, 'demuxed') });
    assert(started.total === 2, `total ${started.total}`);
    for (const job of started.jobs) {
      await waitDone(client, job.jobId, 45000);
      assert(fs.existsSync(job.output) && fs.statSync(job.output).size > 0, `missing output ${job.output}`);
    }
  });

  await check('remux/demux failures map to stable error codes', async () => {
    const ghost = await callToolRaw(client, 'remux_media', {
      input: fx.video,
      container: 'mkv',
      addSubtitle: [{ file: path.join(fx.dir, 'ghost.srt') }],
    });
    assert(ghost.ok === false && ghost.code === 'AUXILIARY_INPUT_NOT_FOUND', JSON.stringify(ghost));
    const incompatible = await callToolRaw(client, 'remux_media', { input: fx.video, container: 'ts', chapters: { file: fx.chapters } });
    assert(incompatible.ok === false && incompatible.code === 'INCOMPATIBLE_CONTAINER', JSON.stringify(incompatible));
    const noStream = await callToolRaw(client, 'demux_media', { input: fx.video, subtitles: true });
    assert(noStream.ok === false && noStream.code === 'STREAM_NOT_FOUND', JSON.stringify(noStream));
  });

  await check('cancel_job removes queued jobs and rejects unknown ids', async () => {
    const first = await callTool(client, 'convert_media', {
      input: fx.long,
      output: path.join(outDir, 'cancel-1.mp4'),
      videoCodec: 'libx264',
      concurrency: 1,
      transcoder: 'FFMPEG',
    });
    const queued = await callTool(client, 'convert_media', {
      input: fx.long,
      output: path.join(outDir, 'cancel-2.mp4'),
      videoCodec: 'libx264',
      concurrency: 1,
      transcoder: 'FFMPEG',
    });
    const cancelled = await callTool(client, 'cancel_job', { jobId: queued.jobId });
    assert(cancelled.cancelled === true, JSON.stringify(cancelled));
    const ghost = await callToolRaw(client, 'get_job', { jobId: queued.jobId });
    assert(ghost.ok === false, 'cancelled job should no longer resolve');
    const unknown = await callToolRaw(client, 'cancel_job', { jobId: 'no-such-job' });
    assert(unknown.ok === false, 'unknown cancel should return ok:false');
    const running = await callToolRaw(client, 'cancel_job', { jobId: first.jobId });
    assert(running.cancelled === true, `running cancel: ${JSON.stringify(running)}`);
    await waitFor(
      async () => {
        const jobs = await callTool(client, 'list_jobs', {});
        for (const id of [first.jobId, queued.jobId]) {
          assert(!jobs.some((job) => job.id === id), `job ${id} still listed`);
        }
      },
      { timeout: 30000 },
    );
  });

  await runResourcesAndPrompts(client);
}

async function runResourcesAndPrompts(client) {
  await check('resources list/read serve the three encodex:// documents', async () => {
    const { resources } = await client.listResources();
    const uris = resources.map((resource) => resource.uri).sort();
    assert(JSON.stringify(uris) === JSON.stringify([...RESOURCE_URIS].sort()), `got ${uris.join(', ')}`);
    for (const resource of resources) {
      assert(resource.mimeType === 'application/json', `${resource.uri} mime ${resource.mimeType}`);
    }
    for (const uri of RESOURCE_URIS) {
      const { contents } = await client.readResource({ uri });
      assert(Array.isArray(contents) && contents.length > 0, `${uri} returned no contents`);
      assert(contents[0].mimeType === 'application/json', `${uri} mime ${contents[0].mimeType}`);
      const parsed = JSON.parse(contents[0].text);
      assert(parsed !== null, `${uri} did not parse as JSON`);
      if (uri === 'encodex://profiles') {
        assert(Array.isArray(parsed) && parsed.length > 0, 'profiles resource is empty');
      } else if (uri === 'encodex://capabilities') {
        assert(Array.isArray(parsed.videoEncoders) && parsed.videoEncoders.length > 0, 'capabilities resource has no encoders');
      } else {
        assert(Array.isArray(parsed.videoCodecs) && parsed.videoCodecs.length > 0, 'codecs resource has no video codecs');
        assert(Array.isArray(parsed.audioCodecs) && parsed.audioCodecs.length > 0, 'codecs resource has no audio codecs');
      }
    }
  });

  await check('prompts list/get render all four prompts', async () => {
    const { prompts } = await client.listPrompts();
    const names = prompts.map((prompt) => prompt.name).sort();
    assert(JSON.stringify(names) === JSON.stringify([...PROMPT_NAMES].sort()), `got ${names.join(', ')}`);
    for (const prompt of prompts) {
      assert(prompt.description && prompt.description.length > 10, `${prompt.name} has no description`);
    }
    const samples = {
      'convert-video': { input: '/tmp/sample.mp4', videoCodec: 'libx264' },
      'extract-audio': { input: '/tmp/sample.mp4', audioCodec: 'libmp3lame' },
      'compress-image': { input: '/tmp/sample.jpg', format: 'webp' },
      'batch-convert': { inputs: '/tmp/a.mp4, /tmp/b.mp4' },
    };
    for (const [name, args] of Object.entries(samples)) {
      const got = await client.getPrompt({ name, arguments: args });
      assert(Array.isArray(got.messages) && got.messages.length > 0, `${name} returned no messages`);
      const content = got.messages[0].content;
      assert(content && (content.text ?? '').length > 0, `${name} message is empty`);
    }
  });
}

async function runStdioSuite(fx) {
  openSection('stdio-15-tools');
  let stderr = '';
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [DIST_MCP_STDIO],
    stderr: 'pipe',
    env: { ...process.env },
  });
  transport.stderr?.on('data', (chunk) => {
    stderr += chunk.toString();
    if (stderr.length > 8192) stderr = stderr.slice(-8192);
  });
  const client = new Client({ name: 'encodex-mcp-full-test', version: '1.0.0' });
  const failsBefore = results.filter((result) => result.status === 'fail').length;
  const connected = await check('establish stdio MCP session', async () => {
    await client.connect(transport);
  });
  if (connected) {
    await runCoreSuite(client, fx, { expectedTools: CORE_TOOLS, mode: 'full', outDir: fx.outStdio });
  }
  await client.close().catch(() => undefined);
  if (results.filter((result) => result.status === 'fail').length > failsBefore && stderr.trim()) {
    console.error(`  [stdio server stderr]\n${stderr.trim()}`);
  }
}

function spawnHttpServer() {
  const child = spawn(process.execPath, [DIST_MCP_HTTP, '--token', HTTP_TOKEN, '--max-sessions', '16'], {
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const harness = { child, buffer: '', ready: null, printedToken: null, stderr: '' };
  child.stdout.on('data', (chunk) => {
    harness.buffer += chunk.toString('utf8');
    let index = harness.buffer.indexOf('\n');
    while (index !== -1) {
      const line = harness.buffer.slice(0, index).replace(/\r$/, '');
      harness.buffer = harness.buffer.slice(index + 1);
      const tokenMatch = /^MCP_HTTP_TOKEN=(.+)$/.exec(line);
      if (tokenMatch) harness.printedToken = tokenMatch[1];
      const readyMatch = /MCP_HTTP_READY http:\/\/127\.0\.0\.1:(\d+)/.exec(line);
      if (readyMatch) harness.ready = { port: Number(readyMatch[1]) };
      index = harness.buffer.indexOf('\n');
    }
  });
  child.stderr.on('data', (chunk) => {
    harness.stderr += chunk.toString('utf8');
    if (harness.stderr.length > 8192) harness.stderr = harness.stderr.slice(-8192);
  });
  child.stdout.on('error', () => {});
  child.stderr.on('error', () => {});
  return harness;
}

function rawHttp(port, spec = {}) {
  const { method = 'POST', urlPath = '/mcp', headers = {}, body } = spec;
  return new Promise((resolve, reject) => {
    const req = http.request(
      { host: '127.0.0.1', port, method, path: urlPath, headers: { Connection: 'close', ...headers }, agent: false },
      (res) => {
        const chunks = [];
        const finish = () => resolve({ status: res.statusCode ?? 0, text: Buffer.concat(chunks).toString('utf8') });
        res.on('data', (chunk) => chunks.push(chunk));
        res.on('end', finish);
        res.on('error', finish);
      },
    );
    req.setTimeout(7000, () => req.destroy(new Error('rawHttp timeout')));
    req.on('error', reject);
    if (body !== undefined) req.write(body);
    req.end();
  });
}

async function runHttpSecurityProbes(port) {
  const auth = { Authorization: `Bearer ${HTTP_TOKEN}` };
  const json = { 'Content-Type': 'application/json' };

  await check('rejects requests without a bearer token (401)', async () => {
    const res = await rawHttp(port, {});
    assert(res.status === 401, `status ${res.status}`);
  });

  await check('rejects a wrong bearer token (401)', async () => {
    const res = await rawHttp(port, { headers: { Authorization: 'Bearer wrong-token' } });
    assert(res.status === 401, `status ${res.status}`);
  });

  await check('refuses tokens smuggled through the query string (400)', async () => {
    const res = await rawHttp(port, { urlPath: `/mcp?token=${HTTP_TOKEN}`, headers: { ...auth, ...json }, body: '{}' });
    assert(res.status === 400, `status ${res.status}`);
  });

  await check('rejects a non-loopback Origin (403)', async () => {
    const res = await rawHttp(port, { headers: { ...auth, Origin: 'http://evil.example.com' } });
    assert(res.status === 403, `status ${res.status}`);
  });

  await check('rejects a non-loopback Host (403)', async () => {
    const res = await rawHttp(port, { headers: { ...auth, Host: 'evil.example.com' } });
    assert(res.status === 403, `status ${res.status}`);
  });

  await check('rejects non-MCP paths (404)', async () => {
    const res = await rawHttp(port, { urlPath: '/nope', headers: { ...auth, ...json }, body: '{}' });
    assert(res.status === 404, `status ${res.status}`);
  });

  await check('rejects unsupported methods (405)', async () => {
    const res = await rawHttp(port, { method: 'PUT', headers: { ...auth, ...json }, body: '{}' });
    assert(res.status === 405, `status ${res.status}`);
  });

  await check('rejects wrong content types (415)', async () => {
    const res = await rawHttp(port, { headers: { ...auth, 'Content-Type': 'text/plain' }, body: '{}' });
    assert(res.status === 415, `status ${res.status}`);
  });

  await check('refuses oversized request bodies (413)', async () => {
    const res = await rawHttp(port, { headers: { ...auth, ...json, 'Content-Length': String(20 * 1024 * 1024) }, body: 'x' });
    assert(res.status === 413, `status ${res.status}`);
  });

  await check('refuses session-less GET requests (400)', async () => {
    const res = await rawHttp(port, { method: 'GET', headers: { ...auth } });
    assert(res.status === 400, `status ${res.status}`);
  });
}

async function connectHttp(endpoint, clientName, { retries = 1, timeoutMs = 15000 } = {}) {
  const deadline = Date.now() + timeoutMs;
  let lastError;
  for (let attempt = 0; attempt < retries; attempt += 1) {
    const transport = new StreamableHTTPClientTransport(new URL(endpoint.url), {
      ...(endpoint.token ? { requestInit: { headers: { Authorization: `Bearer ${endpoint.token}` } } } : {}),
    });
    const client = new Client({ name: clientName, version: '1.0.0' });
    try {
      await client.connect(transport);
      return { client, transport };
    } catch (error) {
      lastError = error;
      await client.close().catch(() => undefined);
      if (Date.now() >= deadline) break;
      await sleep(1000);
    }
  }
  throw lastError ?? new Error('HTTP connect failed');
}

async function runHttpSuite(fx) {
  openSection('http-standalone-15-tools');
  const harness = spawnHttpServer();
  const stopServer = onceCleanup(async () => {
    harness.child.kill();
  });
  try {
    await waitFor(() => assert(harness.ready, `server never became ready. stderr: ${harness.stderr}`), { timeout: 15000, interval: 50 });
    const port = harness.ready.port;
    await check('server printed its generated bearer token', () => {
      assert(harness.printedToken === HTTP_TOKEN, `token line: ${harness.printedToken}`);
    });
    await runHttpSecurityProbes(port);
    const failsBefore = results.filter((result) => result.status === 'fail').length;
    let session = null;
    const connected = await check('establish authenticated HTTP MCP session', async () => {
      session = await connectHttp({ url: `http://127.0.0.1:${port}/mcp`, token: HTTP_TOKEN }, 'encodex-mcp-full-test-http');
    });
    if (connected) {
      await runCoreSuite(session.client, fx, { expectedTools: CORE_TOOLS, mode: 'full', outDir: fx.outHttp });
      await session.client.close().catch(() => undefined);
    }
    if (results.filter((result) => result.status === 'fail').length > failsBefore && harness.stderr.trim()) {
      console.error(`  [http server stderr]\n${harness.stderr.trim()}`);
    }
  } finally {
    await stopServer();
  }
}

function electronUserDataDir() {
  if (process.platform === 'win32') {
    return path.join(process.env.APPDATA ?? path.join(os.homedir(), 'AppData', 'Roaming'), APP_USER_DATA_DIR);
  }
  if (process.platform === 'darwin') {
    return path.join(os.homedir(), 'Library', 'Application Support', APP_USER_DATA_DIR);
  }
  return path.join(process.env.XDG_CONFIG_HOME ?? path.join(os.homedir(), '.config'), APP_USER_DATA_DIR);
}

async function isReachable(url, token) {
  try {
    await fetch(url, {
      method: 'GET',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      signal: AbortSignal.timeout(3000),
    });
    return true;
  } catch {
    return false;
  }
}

async function waitHttpReachable(url, token, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  let lastError;
  while (Date.now() < deadline) {
    try {
      await fetch(url, {
        method: 'GET',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        signal: AbortSignal.timeout(3000),
      });
      return;
    } catch (error) {
      lastError = error;
      await sleep(500);
    }
  }
  throw new Error(`endpoint ${url} never came up: ${lastError instanceof Error ? lastError.message : lastError}`);
}

async function stopProcess(child) {
  if (!child || child.exitCode !== null || child.pid === undefined) return;
  if (process.platform === 'win32') {
    spawnSync('taskkill', ['/PID', String(child.pid), '/T', '/F'], { stdio: 'ignore' });
    return;
  }
  child.kill('SIGTERM');
  const deadline = Date.now() + 5000;
  while (child.exitCode === null && Date.now() < deadline) await sleep(100);
  if (child.exitCode === null) child.kill('SIGKILL');
}

async function runEmbeddedSuite(fx, endpoint, { ownsInstance }) {
  openSection('vscode-endpoint-21-tools');
  const { client } = await connectHttp(endpoint, 'encodex-mcp-full-test-vscode', {
    retries: ownsInstance ? 60 : 5,
    timeoutMs: ownsInstance ? 90000 : 20000,
  });

  await runCoreSuite(client, fx, { expectedTools: ALL_TOOLS, mode: 'light', outDir: fx.outGui });

  await check('get_queue_state reports the shared queue', async () => {
    const state = await callTool(client, 'get_queue_state', {});
    assert(Array.isArray(state.jobs), 'jobs is not an array');
    assert(Number.isInteger(state.pending) && state.pending >= 0, `pending: ${state.pending}`);
  });

  await check('get_system_info reports platform and app version', async () => {
    const sys = await callTool(client, 'get_system_info', {});
    assert(typeof sys.appVersion === 'string' && sys.appVersion.length > 0, `appVersion: ${sys.appVersion}`);
    assert(sys.platform === process.platform, `platform ${sys.platform}`);
    assert(sys.os && sys.os.cpuCount >= 1, 'os block missing');
  });

  await check('get_timeline probes the generated clip', async () => {
    const timeline = await callTool(client, 'get_timeline', { input: fx.video });
    assert(timeline.file === fx.video, `file ${timeline.file}`);
    assert(Number(timeline.duration) > 0, `duration ${timeline.duration}`);
    assert(Number(timeline.width) > 0 && Number(timeline.height) > 0, `${timeline.width}x${timeline.height}`);
    assert(timeline.codec, 'codec missing');
  });

  await check('extract_preview returns a base64 data URL', async () => {
    const preview = await callTool(client, 'extract_preview', { input: fx.video });
    assert(
      typeof preview.dataUrl === 'string' && preview.dataUrl.startsWith('data:image'),
      `dataUrl: ${String(preview.dataUrl).slice(0, 40)}`,
    );
  });

  await check('check_for_updates answers the releases feed', async () => {
    const update = await callToolRaw(client, 'check_for_updates', {});
    if (update.ok === false) {
      warn(`check_for_updates unavailable (offline?): ${update.code ?? update.message ?? 'unknown error'}`);
      return;
    }
    assert(typeof update.available === 'boolean', JSON.stringify(update));
  });

  await check('cancel_all_jobs drains the queue', async () => {
    const before = await callTool(client, 'get_queue_state', {});
    if (before.pending > 0 && !ownsInstance) {
      warn('skipped cancel_all_jobs: a live EncodeX instance has pending jobs of its own');
      return;
    }
    const res = await callTool(client, 'cancel_all_jobs', {});
    assert(res.cancelled === true, JSON.stringify(res));
    const after = await callTool(client, 'get_queue_state', {});
    assert(after.pending === 0, `pending still ${after.pending}`);
  });

  await client.close().catch(() => undefined);
}

async function runEmbeddedPhase(fx, endpoint) {
  const reachable = await isReachable(endpoint.url, endpoint.token);
  let settingsPath = null;
  let settingsBackup;
  let seeded = false;
  let child = null;
  let ownsInstance = false;

  const stopChild = onceCleanup(() => stopProcess(child));
  const restoreSettings = onceCleanup(() => {
    if (!seeded) return;
    try {
      if (settingsBackup === undefined) {
        if (fs.existsSync(settingsPath)) fs.unlinkSync(settingsPath);
      } else {
        fs.writeFileSync(settingsPath, settingsBackup, 'utf8');
      }
      console.log(`  restored ${settingsPath}`);
    } catch (error) {
      console.error(`  WARN could not restore ${settingsPath}: ${error instanceof Error ? error.message : error}`);
    }
    seeded = false;
  });

  try {
    if (reachable) {
      console.log(`\n  endpoint ${endpoint.url} is already up - using the running EncodeX instance`);
    } else {
      openSection('vscode-endpoint-21-tools');
      ownsInstance = true;
      settingsPath = path.join(electronUserDataDir(), MCP_SETTINGS_FILE);
      const seededOk = await check('seed mcp-settings.json to enable the embedded server', () => {
        if (fs.existsSync(settingsPath)) settingsBackup = fs.readFileSync(settingsPath, 'utf8');
        fs.mkdirSync(path.dirname(settingsPath), { recursive: true });
        fs.writeFileSync(settingsPath, JSON.stringify({ enabled: true, port: endpoint.port, token: endpoint.token }, null, 2), 'utf8');
        seeded = true;
      });
      if (!seededOk) return;
      const electronModule = await import('electron');
      const electronPath = electronModule.default ?? electronModule;
      child = spawn(electronPath, [ROOT], { cwd: ROOT, env: { ...process.env }, stdio: ['ignore', 'pipe', 'pipe'] });
      let guiStderr = '';
      child.stderr?.on('data', (chunk) => {
        guiStderr += chunk.toString('utf8');
        if (guiStderr.length > 8192) guiStderr = guiStderr.slice(-8192);
      });
      child.stdout?.on('data', () => {});
      child.on('error', (error) => {
        console.error(`  electron spawn error: ${error.message}`);
      });
      const spawnFailure = new Promise((resolve, reject) => child.once('error', reject));
      const launched = await check('launch the EncodeX GUI with the embedded MCP server', async () => {
        assert(child.pid, 'no pid');
        await Promise.race([waitHttpReachable(endpoint.url, endpoint.token, 90000), spawnFailure]);
      });
      if (!launched) {
        if (guiStderr.trim()) console.error(`  [gui stderr]\n${guiStderr.trim()}`);
        return;
      }
    }

    await runEmbeddedSuite(fx, endpoint, { ownsInstance });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const hint = /\b401\b/.test(message)
      ? ' - the endpoint requires a bearer token: add headers.Authorization to .vscode/mcp.json or clear the token in EncodeX Settings'
      : '';
    await check('drive the embedded MCP endpoint from the VS Code client config', () => {
      throw new Error(`${message}${hint}`);
    });
  } finally {
    if (ownsInstance) await stopChild();
    await restoreSettings();
  }
}

function printSummary() {
  const passed = results.filter((result) => result.status === 'pass').length;
  const failed = results.filter((result) => result.status === 'fail');
  const warnings = results.filter((result) => result.status === 'warn');
  console.log('\n==== EncodeX MCP full-test summary ====');
  console.log(`passed: ${passed}   failed: ${failed.length}   warnings: ${warnings.length}`);
  for (const warning of warnings) console.log(`  WARN [${warning.section}] ${warning.name}`);
  for (const failure of failed) console.log(`  FAIL [${failure.section}] ${failure.name}${failure.message ? ` - ${failure.message}` : ''}`);
  console.log(failed.length === 0 ? 'RESULT: PASS' : 'RESULT: FAIL');
  return failed.length === 0 ? 0 : 1;
}

async function main() {
  const flags = parseArgs();
  console.log('[mcp-full-test] EncodeX complete MCP feature test (local)');
  preflight(flags);

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'encodex-mcp-full-'));
  const cleanupFixtures = () => {
    if (flags.keepTmp) {
      console.log(`[mcp-full-test] fixtures kept at ${tmpDir}`);
    } else {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  };

  let exitCode = 1;
  try {
    openSection('fixtures');
    const fx = await prepareFixtures(tmpDir);
    fx.outStdio = path.join(tmpDir, 'out-stdio');
    fx.outHttp = path.join(tmpDir, 'out-http');
    fx.outGui = path.join(tmpDir, 'out-gui');
    for (const dir of [fx.outStdio, fx.outHttp, fx.outGui]) fs.mkdirSync(dir, { recursive: true });
    console.log('  PASS fixtures generated with ffmpeg');

    const endpoint = await validateVscodeConfig();
    if (flags.stdio) await runStdioSuite(fx);
    else console.log('\n[stdio suite skipped]');
    if (flags.http) await runHttpSuite(fx);
    else console.log('\n[http suite skipped]');
    if (flags.gui) await runEmbeddedPhase(fx, endpoint);
    else console.log('\n[embedded suite skipped]');
    exitCode = printSummary();
  } finally {
    await runCleanups();
    cleanupFixtures();
  }
  process.exit(exitCode);
}

process.on('SIGINT', async () => {
  console.error('\n[mcp-full-test] interrupted');
  await runCleanups();
  process.exit(130);
});

main().catch((error) => {
  console.error(`[mcp-full-test] fatal: ${error instanceof Error ? (error.stack ?? error.message) : String(error)}`);
  process.exit(1);
});
