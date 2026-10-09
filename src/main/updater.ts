/**
 * @fileoverview Core update logic for the EncodeX application.
 *
 * Checks GitHub Releases for new versions, compares semver tags against the
 * running app version, selects the platform-specific installer asset, and
 * downloads it in-app with progress reporting. On completion, the downloaded
 * installer is launched via shell.openPath and the app quits.
 *
 * All network and filesystem operations run in the main process; the renderer
 * drives the flow via IPC and receives progress/status events.
 *
 * ## Trust model
 *
 * Everything the release API returns is attacker-reachable: a tag can be
 * rewritten, an asset name can carry `..` or a NUL byte, and a download can be
 * redirected or truncated. This module therefore treats the release payload as
 * hostile input and funnels every path that reaches the OS through one
 * validator, {@link resolveInstallerTarget}, which accepts only a plain file
 * name carrying a platform installer extension and resolves it inside the
 * update directory. Redirects are pinned to GitHub-owned hosts, the response
 * body is bounded, and a finished download must match both its
 * `Content-Length` and its published digest before it is ever offered to
 * {@link installUpdate}.
 *
 * The invariants are pinned by `src/main/__tests__/updater-hostile.test.ts`.
 */

import { app, shell, BrowserWindow } from 'electron';
import * as https from 'https';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { Logger } from '../shared/logger';
import type { UpdateInfo, UpdateAsset, UpdateProgress, PendingInstall } from '../shared/types';
import { recordAnalyticsEvent } from '../shared/analytics/AnalyticsService';
import { createAnalyticsEvent } from '../shared/analytics/events';
import { coerceOsString, MAX_OS_STRING_LENGTH } from '../shared/validation';
import {
  LOG_UPDATER_CHECKING,
  LOG_UPDATER_AVAILABLE,
  LOG_UPDATER_NOT_AVAILABLE,
  LOG_UPDATER_DOWNLOADING,
  LOG_UPDATER_DOWNLOADED,
  LOG_UPDATER_INSTALLING,
  LOG_UPDATER_ERROR,
  LOG_UPDATER_CANCELLED,
  LOG_UPDATER_OPEN_RELEASE_NOTES,
  LOG_UPDATER_SCHEDULED_RESTART_INSTALL,
  LOG_UPDATER_CANCELLED_RESTART_INSTALL,
  LOG_UPDATER_READ_PENDING_INSTALL,
  LOG_UPDATER_APPLYING_PENDING_INSTALL,
  LOG_UPDATER_NO_PENDING_INSTALL,
  LOG_UPDATER_REJECTED_ASSET,
  LOG_UPDATER_REJECTED_INSTALLER,
  LOG_UPDATER_REJECTED_REDIRECT,
  LOG_UPDATER_INCOMPLETE_DOWNLOAD,
  LOG_UPDATER_CHECKSUM_MISMATCH,
  LOG_UPDATER_BAD_RELEASE,
  LOG_UPDATER_REJECTED_PENDING,
  LOG_UPDATER_CHECK_TIMEOUT,
} from '../shared/log-constants';

const log = new Logger('main/updater');

/**
 * GitHub owner and repository used for release checks.
 * @const {string} GITHUB_OWNER
 * @const {string} GITHUB_REPO
 */
const GITHUB_OWNER = 'Sandeepv68';
const GITHUB_REPO = 'EncodeX';

/**
 * Base URL for the GitHub Releases API.
 * @const {string} RELEASES_API_URL
 */
const RELEASES_API_URL = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/releases/latest`;

/**
 * Directory name under the system temp path where update assets are stored.
 * @const {string} UPDATE_DIR_NAME
 */
const UPDATE_DIR_NAME = 'EncodeX-updater';

/**
 * How long the release-metadata request may take before it is abandoned.
 *
 * Without it a host that accepts the connection and then stalls leaves the
 * check promise pending forever, and the renderer's "Checking for updates..."
 * never resolves.
 * @const {number} API_TIMEOUT_MS
 */
const API_TIMEOUT_MS = 15_000;

/**
 * Hard ceiling on the release-metadata response body.
 *
 * A real `releases/latest` payload with a few dozen assets is well under
 * 200 KB; 4 MB leaves room for a release with thousands of assets while still
 * refusing to buffer whatever a hostile endpoint chooses to send.
 * @const {number} MAX_RELEASE_JSON_BYTES
 */
const MAX_RELEASE_JSON_BYTES = 4 * 1024 * 1024;

/**
 * How many consecutive redirects a download may follow before it is refused.
 *
 * The GitHub CDN chain is at most two hops. Anything past a small budget is a
 * loop, and following it recursively is how a redirect pair pins the main
 * process until the stack runs out.
 * @const {number} MAX_REDIRECTS
 */
const MAX_REDIRECTS = 5;

/**
 * Largest asset size the updater will believe, in bytes.
 *
 * `size` is attacker-controlled data that crosses the IPC boundary into a field
 * typed as a byte count. The largest desktop installer in the wild is a few
 * hundred MB, so a 4 GB ceiling is generous; anything above it (`2**53`,
 * `Infinity`, a string, a negative) is normalised to `0` rather than forwarded
 * to a progress bar as a number no arithmetic can use.
 * @const {number} MAX_ASSET_SIZE_BYTES
 */
const MAX_ASSET_SIZE_BYTES = 4 * 1024 * 1024 * 1024;

/**
 * How long a download may go without delivering a chunk before it is aborted.
 *
 * Deliberately an *idle* timeout rather than a total-duration cap: a 300 MB
 * installer on a slow link is legitimate and must not be cut off, but a
 * connection that stops mid-body should not hang the flow forever.
 * @const {number} DOWNLOAD_IDLE_TIMEOUT_MS
 */
const DOWNLOAD_IDLE_TIMEOUT_MS = 60_000;

/**
 * Hosts an installer download may be redirected to.
 *
 * GitHub serves release assets from `github.com` and redirects once to a
 * `*.githubusercontent.com` CDN host. Pinning that set means a hostile release
 * (or anything that can tamper with the response) cannot steer the installer
 * fetch at a host it also controls. A new CDN host is a one-line change here,
 * and failing closed is the correct default.
 * @const {ReadonlySet<string>} ALLOWED_DOWNLOAD_HOSTS
 */
const ALLOWED_DOWNLOAD_HOSTS: ReadonlySet<string> = new Set([
  'github.com',
  'objects.githubusercontent.com',
  'release-assets.githubusercontent.com',
  'github-releases.githubusercontent.com',
]);

/**
 * Digest algorithms accepted from the release payload.
 *
 * An algorithm name is attacker-controlled text handed to `crypto.createHash`,
 * so it is matched against this set rather than passed through. SHA-1 and MD5
 * are excluded because neither is a defence against anyone who can edit the
 * release.
 * @const {ReadonlySet<string>} ALLOWED_DIGEST_ALGORITHMS
 */
const ALLOWED_DIGEST_ALGORITHMS: ReadonlySet<string> = new Set(['sha256', 'sha512']);

/**
 * Active download write stream, used so the download can be cancelled.
 * @type {fs.WriteStream | null}
 */
let activeDownloadStream: fs.WriteStream | null = null;

/**
 * Abort controller for the active HTTPS request, used to cancel downloads.
 * @type {AbortController | null}
 */
let activeAbortController: AbortController | null = null;

/**
 * Idle-timeout handle for the active download, cleared on every terminal path.
 * @type {ReturnType<typeof setTimeout> | null}
 */
let activeIdleTimer: ReturnType<typeof setTimeout> | null = null;

/**
 * The in-flight release check, shared by every concurrent caller.
 *
 * The renderer can fire `CHECK_FOR_UPDATES` as fast as a user can click, and
 * every call was a fresh HTTPS request to GitHub. One promise means one request.
 * @type {Promise<UpdateInfo | null> | null}
 */
let inFlightCheck: Promise<UpdateInfo | null> | null = null;

/**
 * Compares two semver version strings following semver 2.0.0 precedence rules,
 * including pre-release identifiers. Returns 1 if a > b, -1 if a < b, 0 if equal.
 *
 * Rules:
 *  - A leading `v` and any `+build` metadata are stripped first; semver 2.0.0 §10
 *    makes build metadata irrelevant to precedence, so `1.0.0+build.7` and `1.0.0`
 *    are the same version and a rebuild is never offered as an update.
 *  - Major/minor/patch are compared numerically, and every core field must be a
 *    run of digits. A version that is not a version throws rather than being
 *    silently coerced, which is what made `Number('abc') || 0` report a corrupt
 *    tag as `0.0.0`.
 *  - A version without a pre-release outranks one with one ('1.0.0' > '1.0.0-beta.1').
 *  - Pre-release identifiers compare dot-by-dot: numerically when both are
 *    numeric, otherwise lexically; numeric identifiers rank below alphanumeric
 *    ones; a longer identifier set wins when all preceding ones are equal.
 *
 * @param {string} a - First version string (e.g. '1.2.0' or '1.2.0-beta.0').
 * @param {string} b - Second version string.
 * @returns {number} Comparison result.
 * @throws {Error} When either argument is not a parseable version.
 * @example
 * compareVersions('1.0.0+build.7', '1.0.0') // 0
 * compareVersions('1.0.0-beta.10', '1.0.0-beta.9') // 1
 */
export function compareVersions(a: string, b: string): number {
  const va = requireVersion(a);
  const vb = requireVersion(b);

  for (let i = 0; i < Math.max(va.core.length, vb.core.length); i++) {
    const na = va.core[i] ?? 0;
    const nb = vb.core[i] ?? 0;
    if (na > nb) return 1;
    if (na < nb) return -1;
  }

  if (!va.pre && !vb.pre) return 0;
  if (!va.pre) return 1;
  if (!vb.pre) return -1;

  for (let i = 0; i < Math.max(va.pre.length, vb.pre.length); i++) {
    const ia = va.pre[i];
    const ib = vb.pre[i];
    if (ia === undefined) return -1;
    if (ib === undefined) return 1;
    const aIsNum = typeof ia === 'number';
    const bIsNum = typeof ib === 'number';
    if (aIsNum !== bIsNum) {
      return aIsNum ? -1 : 1;
    }
    if (aIsNum && bIsNum && ia !== ib) {
      return (ia as number) > (ib as number) ? 1 : -1;
    }
    if (!aIsNum && !bIsNum && ia !== ib) {
      return String(ia) > String(ib) ? 1 : -1;
    }
  }
  return 0;
}

/**
 * A version split into its comparable parts.
 * @interface ParsedVersion
 * @property {number[]} core - Numeric major/minor/patch, padded by comparison.
 * @property {Array<string|number>|null} pre - Pre-release identifiers, or null when stable.
 */
interface ParsedVersion {
  core: number[];
  pre: Array<string | number> | null;
}

/**
 * Splits a version string into its comparable parts, or returns null when the
 * string is not a version.
 *
 * @param {string} version - Raw version string, with or without a leading `v`.
 * @returns {ParsedVersion | null} The parsed form, or null when unusable.
 */
function parseVersion(version: string): ParsedVersion | null {
  if (typeof version !== 'string') return null;
  const normalized = version.trim().replace(/^v/i, '').replace(/\+.*$/, '');
  if (normalized === '') return null;

  const hyphenIndex = normalized.indexOf('-');
  const corePart = hyphenIndex === -1 ? normalized : normalized.slice(0, hyphenIndex);
  const prePart = hyphenIndex === -1 ? null : normalized.slice(hyphenIndex + 1);
  if (hyphenIndex !== -1 && prePart === '') return null;

  const coreFields = corePart.split('.');
  if (coreFields.length === 0 || coreFields.length > 4) return null;
  const core: number[] = [];
  for (const field of coreFields) {
    if (!/^\d+$/.test(field)) return null;
    core.push(Number(field));
  }

  const pre: Array<string | number> | null = [];
  if (prePart !== null) {
    for (const identifier of prePart.split('.')) {
      // Semver 2.0.0 section 9: an identifier is alphanumerics and hyphens only, and a
      // numeric one has no leading zero. Without this, `2.0.0-nightly-garbage!!` sorted as a
      // prerelease of 2.0.0 and would be offered as an upgrade.
      if (!/^[0-9A-Za-z-]+$/.test(identifier)) return null;
      const numeric = /^\d+$/.test(identifier);
      if (numeric && identifier.length > 1 && identifier.startsWith('0')) return null;
      pre.push(numeric ? Number(identifier) : identifier);
    }
  }

  return { core, pre: prePart === null ? null : pre };
}

/**
 * Parses a version that is required to be one, throwing when it is not.
 *
 * @param {string} version - Candidate version string.
 * @returns {ParsedVersion} The parsed version.
 * @throws {Error} When the string is not a parseable version.
 */
function requireVersion(version: string): ParsedVersion {
  const parsed = parseVersion(version);
  if (parsed === null) throw new Error(`Unparseable version: ${JSON.stringify(version)}`);
  return parsed;
}

/**
 * True when `version` is a string this module can order.
 *
 * Used by the two callers that must not throw on a hostile value: an
 * unparseable tag means "no update", and an unparseable pending version means
 * "do not run that installer".
 *
 * @param {string} version - Candidate version string.
 * @returns {boolean} True when {@link parseVersion} accepts it.
 */
function isUsableVersion(version: string): boolean {
  return typeof version === 'string' && parseVersion(version) !== null;
}

/**
 * The installer file extensions accepted for the current platform.
 *
 * Single source of truth for both {@link selectAsset} and
 * {@link resolveInstallerTarget}, so the file that is chosen and the file that
 * is allowed to be launched can never drift apart.
 *
 * @returns {string[]} Lower-case extensions, including the leading dot.
 */
function installerExtensions(): string[] {
  if (process.platform === 'win32') return ['.exe'];
  if (process.platform === 'darwin') return ['.dmg'];
  return ['.appimage'];
}

/**
 * True when `name` is a plain file name carrying one of this platform's
 * installer extensions.
 *
 * "Plain" is the load-bearing part: a name containing a path separator, a
 * traversal segment or a NUL byte is a path or an attack, not a file name, and
 * `path.join` would happily resolve it outside the update directory.
 *
 * @param {string} name - Candidate asset or installer file name.
 * @returns {boolean} True when the name is a plain installer file name.
 */
function isInstallerFileName(name: string): boolean {
  if (name === '' || name.includes('\0')) return false;
  // Check for Windows/Unix path separators (including backslash on all platforms for security)
  if (name.includes('/') || name.includes('\\')) return false;
  const base = path.basename(name);
  if (base !== name) return false;
  const lower = name.toLowerCase();
  return installerExtensions().some((ext) => lower.endsWith(ext));
}

/**
 * Selects the best-matching release asset for the current platform and architecture.
 *
 * @param {UpdateAsset[]} assets - Available release assets.
 * @returns {UpdateAsset | null} The matched asset, or null if none match.
 */
export function selectAsset(assets: UpdateAsset[]): UpdateAsset | null {
  const arch = process.arch;

  const platformAssets = assets.filter((a) => typeof a?.name === 'string' && isInstallerFileName(a.name));
  if (platformAssets.length === 0) return null;

  const archMatch = platformAssets.find((a) => a.name.toLowerCase().includes(arch));
  return archMatch || platformAssets[0];
}

/**
 * The shape this module needs out of a `releases/latest` payload.
 * @interface RawReleaseAsset
 * @property {string} name - Asset file name.
 * @property {string} browser_download_url - Direct download URL.
 * @property {number} size - Byte count.
 * @property {string} [digest] - GitHub-published digest, e.g. `sha256:ab12...`.
 */
interface RawReleaseAsset {
  name: string;
  browser_download_url: string;
  size: number;
  digest?: string;
}

/** @interface RawRelease - the validated fields of a `releases/latest` payload. */
interface RawRelease {
  tag_name: string;
  body: string;
  html_url: string;
  assets: RawReleaseAsset[];
}

/**
 * Narrows an arbitrary parsed JSON value to a usable release payload.
 *
 * The endpoint is not trusted to be GitHub. Every field the updater reads is
 * checked here, so a truncated, hostile or wrong-shaped body produces one named
 * error instead of a `TypeError` from whichever line happened to touch it first
 * - which is what the renderer used to receive as `UPDATE_ERROR`.
 *
 * @param {unknown} value - The parsed JSON body.
 * @returns {RawRelease} The validated payload.
 * @throws {Error} When a required field is missing or of the wrong type.
 */
function parseRelease(value: unknown): RawRelease {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error('Release payload was not a JSON object');
  }
  const record = value as Record<string, unknown>;
  if (typeof record.tag_name !== 'string' || record.tag_name.trim() === '') {
    throw new Error('Release payload had no usable tag_name');
  }
  if (typeof record.html_url !== 'string') {
    throw new Error('Release payload had no usable html_url');
  }
  if (!Array.isArray(record.assets)) {
    throw new Error('Release payload had no asset array');
  }

  const assets: RawReleaseAsset[] = [];
  for (const entry of record.assets) {
    if (typeof entry !== 'object' || entry === null) {
      throw new Error('Release payload contained a non-object asset');
    }
    const asset = entry as Record<string, unknown>;
    if (typeof asset.name !== 'string' || asset.name === '') {
      throw new Error('Release payload contained an asset with no name');
    }
    if (typeof asset.browser_download_url !== 'string' || asset.browser_download_url === '') {
      throw new Error(`Release asset ${asset.name} had no download URL`);
    }
    assets.push({
      name: asset.name,
      browser_download_url: asset.browser_download_url,
      size:
        typeof asset.size === 'number' && Number.isSafeInteger(asset.size) && asset.size >= 0 && asset.size <= MAX_ASSET_SIZE_BYTES
          ? asset.size
          : 0,
      digest: typeof asset.digest === 'string' ? asset.digest : undefined,
    });
  }

  return {
    tag_name: record.tag_name,
    body: typeof record.body === 'string' ? record.body : '',
    html_url: record.html_url,
    assets,
  };
}

/**
 * Resolved instead of `null` when the repository has no published release.
 *
 * A body that is literally `null` is a valid JSON document, so "404" cannot be
 * signalled by resolving null without making a hostile `null` body
 * indistinguishable from "up to date".
 * @const {symbol} NO_RELEASE
 */
const NO_RELEASE = Symbol('no-release');

/**
 * Performs a GET request to the GitHub Releases API and returns the parsed JSON.
 *
 * The response is bounded by {@link MAX_RELEASE_JSON_BYTES} and the request by
 * {@link API_TIMEOUT_MS}, because an endpoint that never finishes and an
 * endpoint that never stops sending are the same failure from the app's side.
 *
 * @returns {Promise<unknown | symbol>} The latest release payload, or
 *   {@link NO_RELEASE} on 404.
 * @throws {Error} When the request fails, times out, exceeds the size cap, or
 *   returns a non-200 status.
 */
function fetchLatestRelease(): Promise<unknown | typeof NO_RELEASE> {
  return new Promise((resolve, reject) => {
    const req = https.get(
      RELEASES_API_URL,
      {
        headers: {
          'User-Agent': `EncodeX/${app.getVersion()}`,
          Accept: 'application/vnd.github.v3+json',
        },
        signal: AbortSignal.timeout(API_TIMEOUT_MS),
      },
      (res) => {
        if (res.statusCode === 404) {
          resolve(NO_RELEASE);
          return;
        }
        if (res.statusCode !== 200) {
          reject(new Error(`GitHub API returned status ${res.statusCode}`));
          return;
        }

        const chunks: Buffer[] = [];
        let received = 0;
        res.on('data', (chunk: Buffer) => {
          received += chunk.length;
          if (received > MAX_RELEASE_JSON_BYTES) {
            res.destroy();
            reject(new Error('GitHub API response exceeded the size limit'));
            return;
          }
          chunks.push(chunk);
        });
        res.on('end', () => {
          try {
            resolve(JSON.parse(Buffer.concat(chunks).toString('utf-8')));
          } catch (err) {
            reject(new Error(`Failed to parse GitHub API response: ${err}`));
          }
        });
        res.on('error', reject);
      },
    );
    req.on('error', (err: NodeJS.ErrnoException) => {
      reject(err.name === 'TimeoutError' ? new Error(LOG_UPDATER_CHECK_TIMEOUT) : err);
    });
  });
}

/**
 * Runs one release check. Prefer {@link checkForUpdate}, which shares one
 * in-flight request across concurrent callers.
 *
 * @returns {Promise<UpdateInfo | null>} Update information if available, or null.
 * @throws {Error} When the network request or asset selection fails.
 */
async function runCheck(): Promise<UpdateInfo | null> {
  const currentVersion = app.getVersion();
  log.info(LOG_UPDATER_CHECKING, 'current:', currentVersion);

  const payload = await fetchLatestRelease();
  if (payload === NO_RELEASE) {
    log.info(LOG_UPDATER_NOT_AVAILABLE);
    return null;
  }

  const release = parseRelease(payload);
  const remoteVersion = release.tag_name.trim().replace(/^v/i, '');

  if (!isUsableVersion(remoteVersion) || !isUsableVersion(currentVersion)) {
    log.warn(LOG_UPDATER_BAD_RELEASE, 'unorderable version, treating as up to date:', remoteVersion, currentVersion);
    return null;
  }

  if (compareVersions(remoteVersion, currentVersion) <= 0) {
    log.info(LOG_UPDATER_NOT_AVAILABLE);
    return null;
  }

  const assets: UpdateAsset[] = release.assets.map((a) => ({
    name: a.name,
    url: a.browser_download_url,
    size: a.size,
    digest: a.digest,
  }));

  const asset = selectAsset(assets);
  if (!asset) {
    log.warn(LOG_UPDATER_ERROR, 'No matching asset for platform');
    return null;
  }

  const info: UpdateInfo = {
    version: remoteVersion,
    releaseNotes: release.body,
    releaseUrl: release.html_url,
    asset,
  };

  log.info(LOG_UPDATER_AVAILABLE, info.version, asset.name);
  recordAnalyticsEvent(createAnalyticsEvent('update_available', { version: app.getVersion(), newVersion: info.version }));
  return info;
}

/**
 * Checks for a new version by querying the GitHub Releases API.
 *
 * Concurrent callers share a single request, so a renderer that fires
 * `CHECK_FOR_UPDATES` repeatedly cannot fan out into repeated calls to GitHub.
 *
 * @returns {Promise<UpdateInfo | null>} Update information if available, or
 *   null when the app is up to date, the payload is unusable, or no asset matches.
 * @throws {Error} When the network request fails.
 */
export function checkForUpdate(): Promise<UpdateInfo | null> {
  if (inFlightCheck) return inFlightCheck;

  const pending = runCheck();
  inFlightCheck = pending;
  // Cleared through `then` rather than `finally`, whose derived promise would
  // re-surface a rejection as an unhandled one.
  const release = (): void => {
    if (inFlightCheck === pending) inFlightCheck = null;
  };
  pending.then(release, release);
  return pending;
}

/**
 * The absolute path of the update cache directory, without creating it.
 *
 * @returns {string} Absolute path of the update directory.
 */
function updateDirPath(): string {
  return path.join(app.getPath('temp'), UPDATE_DIR_NAME);
}

/**
 * The single choke point for anything that will reach `shell.openPath`.
 *
 * Accepts a value only when it is a usable OS string, a plain file name
 * carrying this platform's installer extension, and a path that resolves
 * inside the update directory. Everything else is null. This is what keeps an
 * attacker-supplied `..` segment, an absolute path, a NUL byte or a `.bat` from
 * becoming an executed file - whether the value arrived from the renderer over
 * IPC, from the release payload, or from the pending-install marker on disk.
 *
 * Two forms are accepted, because the module hands out the second one itself:
 * a bare file name, and the exact absolute path inside the update directory
 * that {@link downloadUpdate} resolves to. An absolute path pointing anywhere
 * else is rejected rather than quietly remapped, so a smuggled path can never
 * turn into a launch of a same-named file that happens to be lying around.
 *
 * @param {unknown} candidate - Untrusted path.
 * @returns {string | null} The absolute installer path, or null when rejected.
 */
function resolveInstallerTarget(candidate: unknown): string | null {
  const name = coerceOsString(candidate);
  if (name === null) return null;

  const base = path.basename(name);
  if (!isInstallerFileName(base)) return null;

  const dir = path.resolve(updateDirPath());
  const resolved = path.resolve(dir, base);
  if (name !== base && path.resolve(name) !== resolved) return null;

  const relative = path.relative(dir, resolved);
  if (relative === '' || relative.startsWith('..') || path.isAbsolute(relative)) return null;
  return resolved;
}

/**
 * Deletes a partially written installer, best-effort.
 *
 * Leaving a truncated or unverified executable in the update directory is the
 * failure mode U9/U10 describe: a later `installUpdate` would happily launch
 * whatever survived.
 *
 * @param {string} destPath - Path to remove.
 * @returns {void}
 */
function discardPartialDownload(destPath: string): void {
  try {
    if (fs.existsSync(destPath)) fs.unlinkSync(destPath);
  } catch (err) {
    log.warn(LOG_UPDATER_ERROR, 'Failed to remove partial download:', err);
  }
}

/**
 * File name of the pending restart-install marker inside the userData dir.
 * @const {string}
 */
const PENDING_INSTALL_FILENAME = 'pending-install.json';

/**
 * Resolves the absolute path of the pending restart-install marker file.
 * Stored under `userData` (not the volatile temp dir) so it survives OS temp
 * cleanup between sessions.
 *
 * @returns {string} Absolute path of the marker file.
 */
function getPendingInstallPath(): string {
  return path.join(app.getPath('userData'), PENDING_INSTALL_FILENAME);
}

/**
 * Persists a pending "apply this update on the next app restart" marker.
 *
 * The marker is written to `userData/pending-install.json` and consumed by
 * {@link autoInstallPendingUpdate} on the next GUI-mode startup. The path is
 * validated by {@link resolveInstallerTarget} before it is written, so the
 * marker can never be the thing that smuggles an arbitrary path to the next
 * launch.
 *
 * @param {string} installerPath - Absolute path of the downloaded installer.
 * @param {string} version - Update version the installer targets.
 * @returns {void}
 */
export function scheduleInstallOnRestart(installerPath: string, version: string): void {
  const target = resolveInstallerTarget(installerPath);
  if (target === null || !isUsableVersion(version)) {
    log.warn(LOG_UPDATER_REJECTED_INSTALLER, 'not scheduling restart install for', String(installerPath));
    return;
  }
  log.info(LOG_UPDATER_SCHEDULED_RESTART_INSTALL, target, version);
  try {
    fs.mkdirSync(app.getPath('userData'), { recursive: true });
    const payload: PendingInstall = { installerPath: target, version };
    fs.writeFileSync(getPendingInstallPath(), JSON.stringify(payload, null, 2), 'utf-8');
  } catch (err) {
    log.warn(LOG_UPDATER_ERROR, 'Failed to persist restart install marker:', err);
  }
}

/**
 * Removes the pending restart-install marker, if present. Idempotent.
 *
 * @returns {void}
 */
export function cancelRestartInstall(): void {
  log.info(LOG_UPDATER_CANCELLED_RESTART_INSTALL);
  try {
    const filePath = getPendingInstallPath();
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  } catch (err) {
    log.warn(LOG_UPDATER_ERROR, 'Failed to remove restart install marker:', err);
  }
}

/**
 * Reads the pending restart-install marker, returning null when absent, empty,
 * corrupt, or unusable. Never throws.
 *
 * Both fields go through `coerceOsString`, so a megabyte-long path is refused
 * here rather than handed to the OS at startup. Containment and extension are
 * re-checked at launch time by {@link resolveInstallerTarget}, because the file
 * on disk may have been replaced since it was written.
 *
 * @returns {PendingInstall | null} The persisted marker, or null.
 */
export function readPendingInstall(): PendingInstall | null {
  try {
    const filePath = getPendingInstallPath();
    if (!fs.existsSync(filePath)) return null;
    const raw = fs.readFileSync(filePath, 'utf-8');
    if (raw.length > MAX_OS_STRING_LENGTH * 4) {
      log.warn(LOG_UPDATER_REJECTED_PENDING, 'marker file is implausibly large');
      return null;
    }
    if (!raw.trim()) return null;
    const parsed = JSON.parse(raw) as Partial<PendingInstall>;
    if (typeof parsed !== 'object' || parsed === null) return null;
    // Copied field by field, so a `__proto__` key in the marker cannot reach a prototype.
    const installerPath = coerceOsString(parsed.installerPath);
    const version = coerceOsString(parsed.version);
    if (installerPath === null || version === null) return null;
    log.info(LOG_UPDATER_READ_PENDING_INSTALL, installerPath, version);
    return { installerPath, version };
  } catch (err) {
    log.warn(LOG_UPDATER_ERROR, 'Failed to read restart install marker:', err);
    return null;
  }
}

/**
 * Applies a pending restart-install marker at startup.
 *
 * When a marker exists the installer is launched and the app quits before any
 * window is created. The marker is always cleared first (single fire), so a
 * cancelled installer dialog never re-launches on the next start.
 *
 * This runs before the user has seen anything, which makes it the most
 * sensitive call site in the module: the marker is a file on disk, so its
 * contents are only as trustworthy as the machine. Both fields are therefore
 * re-validated here - the path must resolve inside the update directory through
 * {@link resolveInstallerTarget}, and the version must be a real version *newer
 * than the running one*. A blank, absent or unparseable version refuses to
 * apply, rather than short-circuiting the comparison and running the installer
 * unconditionally.
 *
 * @returns {Promise<void>} Resolves once any pending install has been handled.
 */
export async function autoInstallPendingUpdate(): Promise<void> {
  const pending = readPendingInstall();
  if (!pending) {
    log.info(LOG_UPDATER_NO_PENDING_INSTALL);
    return;
  }
  cancelRestartInstall();

  const target = resolveInstallerTarget(pending.installerPath);
  if (target === null) {
    log.warn(LOG_UPDATER_REJECTED_PENDING, 'installer path is not an installer inside the update dir');
    return;
  }
  if (!isUsableVersion(pending.version)) {
    log.warn(LOG_UPDATER_REJECTED_PENDING, 'marker version is not a version:', pending.version);
    return;
  }
  if (compareVersions(pending.version, app.getVersion()) <= 0) {
    log.info(LOG_UPDATER_NOT_AVAILABLE, 'Pending version', pending.version, 'already installed');
    return;
  }
  if (!fs.existsSync(target)) {
    log.warn(LOG_UPDATER_ERROR, 'Pending installer missing:', target);
    return;
  }

  log.info(LOG_UPDATER_APPLYING_PENDING_INSTALL, target);
  await shell.openPath(target);
  app.quit();
}

/**
 * Splits a GitHub asset digest into an algorithm and hex value, when both are
 * usable.
 *
 * @param {string | undefined} digest - Digest string, e.g. `sha256:ab12...`.
 * @returns {{ algorithm: string; hex: string } | null} The parsed digest, or null.
 */
function parseChecksum(digest: string | undefined): { algorithm: string; hex: string } | null {
  if (typeof digest !== 'string') return null;
  const separator = digest.indexOf(':');
  if (separator <= 0) return null;
  const algorithm = digest.slice(0, separator).toLowerCase();
  const hex = digest.slice(separator + 1).toLowerCase();
  if (!ALLOWED_DIGEST_ALGORITHMS.has(algorithm)) return null;
  const expectedLength = algorithm === 'sha256' ? 64 : 128;
  if (hex.length !== expectedLength || !/^[0-9a-f]+$/.test(hex)) return null;
  return { algorithm, hex };
}

/**
 * True when an installer download URL is somewhere this app is willing to fetch from.
 *
 * Applied to the initial URL as well as every redirect hop: the initial URL comes
 * off the release payload, so it is exactly as attacker-chosen as a `Location`
 * header.
 *
 * @param {string} location - Absolute URL to test.
 * @returns {boolean} True when the URL is https and on an allowed host.
 */
function isAllowedDownloadUrl(location: string): boolean {
  let parsed: URL;
  try {
    parsed = new URL(location);
  } catch {
    return false;
  }
  if (parsed.protocol !== 'https:') return false;
  return ALLOWED_DOWNLOAD_HOSTS.has(parsed.hostname);
}

/**
 * True when a `Content-Type` is something an installer never is.
 *
 * A captive portal or an intercepting proxy answering `<!doctype html>` with a
 * 200 is the realistic way a "download" turns into a web page, and nothing
 * downstream can tell the difference from a truncated file.
 *
 * @param {string | string[] | undefined} contentType - Response header value.
 * @returns {boolean} True when the type rules out an installer.
 */
function isNotAnInstallerContentType(contentType: string | string[] | undefined): boolean {
  const value = Array.isArray(contentType) ? contentType[0] : contentType;
  if (typeof value !== 'string') return false;
  const mime = value.split(';')[0].trim().toLowerCase();
  return mime === 'text/html' || mime === 'application/xhtml+xml';
}

/**
 * Arms the idle timer for the active download.
 *
 * @returns {void}
 */
function armIdleTimer(): void {
  clearIdleTimer();
  const timer = setTimeout(() => {
    activeIdleTimer = null;
    cancelDownload();
  }, DOWNLOAD_IDLE_TIMEOUT_MS);
  // Unref'd so a pending download never holds the process open on its own.
  if (typeof timer === 'object' && typeof timer.unref === 'function') timer.unref();
  activeIdleTimer = timer;
}

/** @returns {void} Clears the active download's idle timer, if any. */
function clearIdleTimer(): void {
  if (activeIdleTimer === null) return;
  clearTimeout(activeIdleTimer);
  activeIdleTimer = null;
}

/**
 * Downloads a file from the given URL into the update directory, reporting
 * progress via the BrowserWindow's webContents.
 *
 * Every hop is validated, and the result is verified before it is offered:
 *
 *  - the file name must be a plain installer file name inside the update dir
 *    ({@link resolveInstallerTarget}), which is what closes the traversal hole;
 *  - a redirect must be https and on a GitHub-owned host, within a hop budget;
 *  - the body must not be an HTML error page;
 *  - the byte count must match `Content-Length` when one was advertised;
 *  - the digest must match when the release published one.
 *
 * A failure at any of those points removes the partial file, so nothing
 * unverified is left on disk for a later launch to pick up.
 *
 * @param {string} url - The download URL.
 * @param {string} filename - The target filename.
 * @param {BrowserWindow} win - The main window for sending progress events.
 * @param {string} [digest] - GitHub-published digest for the asset.
 * @param {number} [hops] - Redirects already followed, for the budget.
 * @returns {Promise<string>} The absolute path of the downloaded file.
 * @throws {Error} When the download fails, is refused, or fails verification.
 */
function downloadFile(url: string, filename: string, win: BrowserWindow, digest?: string, hops = 0): Promise<string> {
  return new Promise((resolve, reject) => {
    const destPath = resolveInstallerTarget(filename);
    if (destPath === null) {
      log.warn(LOG_UPDATER_REJECTED_ASSET, filename);
      reject(new Error(`Refusing to download an asset named ${filename}`));
      return;
    }
    if (!isAllowedDownloadUrl(url) || !url.startsWith('https://')) {
      log.warn(LOG_UPDATER_REJECTED_REDIRECT, url);
      reject(new Error('Refusing to download the update from an untrusted host'));
      return;
    }

    const controller = new AbortController();
    activeAbortController = controller;

    /**
     * Failure path for a request-level error.
     *
     * Declared outside the response callback so `req.on('error')` can reach it:
     * a socket error can fire after the response has started streaming, and a
     * bare `reject` there would leave the idle timer armed, the active-download
     * slots occupied and the partial file on disk.
     *
     * @param {Error} err - The request error.
     * @returns {void}
     */
    let failViaRequest = (err: Error): void => {
      reject(err.name === 'AbortError' ? new Error('Download cancelled') : err);
    };

    const req = https.get(
      url,
      {
        headers: { 'User-Agent': `EncodeX/${app.getVersion()}` },
        signal: controller.signal,
      },
      (res) => {
        if (res.statusCode === 302 || res.statusCode === 301) {
          const location = res.headers.location;
          res.destroy();
          if (typeof location !== 'string' || location === '') {
            reject(new Error('Redirect response had no Location header'));
            return;
          }
          if (hops + 1 > MAX_REDIRECTS) {
            log.warn(LOG_UPDATER_REJECTED_REDIRECT, `more than ${MAX_REDIRECTS} hops`);
            reject(new Error('Too many redirects while downloading the update'));
            return;
          }
          if (!isAllowedDownloadUrl(location)) {
            log.warn(LOG_UPDATER_REJECTED_REDIRECT, location);
            reject(new Error('Refusing a download redirect to an untrusted host'));
            return;
          }
          // Releases are downloaded to the same validated name on every hop.
          downloadFile(location, filename, win, digest, hops + 1).then(resolve, reject);
          return;
        }
        if (res.statusCode !== 200) {
          reject(new Error(`Download failed with status ${res.statusCode}`));
          return;
        }
        if (isNotAnInstallerContentType(res.headers['content-type'])) {
          reject(new Error(`Refusing a download served as ${String(res.headers['content-type'])}`));
          return;
        }

        const expected = parseChecksum(digest);
        const hash = expected ? crypto.createHash(expected.algorithm) : null;

        const advertised = res.headers['content-length'];
        const advertisedLength = Number(Array.isArray(advertised) ? advertised[0] : advertised);
        const totalBytes = Number.isFinite(advertisedLength) && advertisedLength > 0 ? advertisedLength : 0;
        let transferredBytes = 0;
        let lastReportTime = 0;

        const fileStream = fs.createWriteStream(destPath);
        activeDownloadStream = fileStream;

        let settled = false;
        const finish = (fn: () => void): void => {
          if (settled) return;
          settled = true;
          clearIdleTimer();
          activeDownloadStream = null;
          activeAbortController = null;
          fn();
        };
        const fail = (err: Error): void => {
          finish(() => {
            fileStream.destroy();
            discardPartialDownload(destPath);
            reject(err);
          });
        };
        failViaRequest = fail;

        // Without this the write stream is a listener-less EventEmitter, so a
        // disk-full or a locked file throws from inside the emit and nothing
        // ever settles the promise.
        fileStream.on('error', (err: Error) => fail(err));
        armIdleTimer();

        res.on('data', (chunk: Buffer) => {
          if (settled) return;
          armIdleTimer();
          hash?.update(chunk);
          fileStream.write(chunk);
          transferredBytes += chunk.length;

          const now = Date.now();
          if (now - lastReportTime > 300 || transferredBytes === totalBytes) {
            lastReportTime = now;
            const progress: UpdateProgress = {
              percent: totalBytes > 0 ? Math.min(100, Math.round((transferredBytes / totalBytes) * 100)) : 0,
              transferred: transferredBytes,
              total: totalBytes,
            };
            if (!win.isDestroyed()) {
              win.webContents.send('update-progress', progress);
            }
          }
        });

        res.on('end', () => {
          if (settled) return;
          if (hash && expected) {
            const actual = hash.digest('hex');
            if (actual.toLowerCase() !== expected.hex) {
              log.warn(LOG_UPDATER_CHECKSUM_MISMATCH, filename);
              fail(new Error('Downloaded installer failed its checksum'));
              return;
            }
          }
          if (totalBytes > 0 && transferredBytes !== totalBytes) {
            log.warn(LOG_UPDATER_INCOMPLETE_DOWNLOAD, `${transferredBytes} of ${totalBytes} bytes for`, filename);
            fail(new Error('Download ended before the advertised size'));
            return;
          }
          fileStream.end(() => finish(() => resolve(destPath)));
        });

        res.on('error', (err: Error) => fail(err));
      },
    );

    // Reassigned inside the response callback to the full failure path (stream
    // teardown plus partial-file removal); before that, no file exists yet.
    req.on('error', failViaRequest);
  });
}

/**
 * Downloads the matched update asset and notifies the renderer of progress.
 * On completion, sends the installer path via UPDATE_DOWNLOADED.
 *
 * @param {UpdateInfo} info - The update information containing the asset URL.
 * @param {BrowserWindow} win - The main window for progress events.
 * @returns {Promise<string>} The absolute path of the downloaded installer.
 */
export async function downloadUpdate(info: UpdateInfo, win: BrowserWindow): Promise<string> {
  log.info(LOG_UPDATER_DOWNLOADING, info.asset.name);
  const filePath = await downloadFile(info.asset.url, info.asset.name, win, info.asset.digest);
  log.info(LOG_UPDATER_DOWNLOADED, filePath);
  recordAnalyticsEvent(createAnalyticsEvent('update_downloaded', { version: app.getVersion(), newVersion: info.version }));
  return filePath;
}

/**
 * Cancels an in-progress download by destroying the write stream and
 * aborting the HTTPS request.
 *
 * @returns {void}
 */
export function cancelDownload(): void {
  log.info(LOG_UPDATER_CANCELLED);
  clearIdleTimer();
  if (activeDownloadStream) {
    activeDownloadStream.destroy();
    activeDownloadStream = null;
  }
  if (activeAbortController) {
    activeAbortController.abort();
    activeAbortController = null;
  }
}

/**
 * Launches the downloaded installer and quits the application.
 *
 * @param {string} installerPath - Absolute path to the downloaded installer.
 * @returns {Promise<void>}
 */
export async function installUpdate(installerPath: string): Promise<void> {
  // `shell.openPath` needs a string and `app.quit()` must not run unless the installer actually
  // started, so an unvalidated payload is dropped up front rather than half-applying the update.
  // Beyond that, the path has to be an installer inside our own update directory: this arrives
  // from the renderer, and "some string" is not the same thing as "the file we just downloaded".
  const target = resolveInstallerTarget(installerPath);
  if (target === null) {
    log.warn(LOG_UPDATER_ERROR, 'ignored install request whose path was not an installer in the update dir');
    return;
  }
  log.info(LOG_UPDATER_INSTALLING, target);
  cancelRestartInstall();
  const pending = readPendingInstall();
  recordAnalyticsEvent(
    createAnalyticsEvent('update_installed', {
      version: app.getVersion(),
      newVersion: pending?.version || '',
    }),
  );
  await shell.openPath(target);
  app.quit();
}

/**
 * Opens the release notes page in the system browser.
 *
 * @param {string} url - The release page URL.
 * @returns {Promise<void>}
 */
export async function openReleaseNotes(url: string): Promise<void> {
  // Narrowed before it reaches `shell.openExternal`, which requires a string. An unvalidated
  // payload from the renderer would otherwise make Electron throw a raw `TypeError` from
  // inside a native call. Nothing to open is not an error worth surfacing to the renderer.
  // The renderer supplies this URL, so it is also pinned to https: `file://`, `smb://` and
  // friends hand the OS a target the release page has no business naming.
  const target = coerceOsString(url);
  if (target === null) {
    log.warn(LOG_UPDATER_ERROR, 'ignored release-notes request whose URL was not a usable string');
    return;
  }
  let parsed: URL;
  try {
    parsed = new URL(target);
  } catch {
    log.warn(LOG_UPDATER_ERROR, 'ignored release-notes request whose URL did not parse');
    return;
  }
  if (parsed.protocol !== 'https:') {
    log.warn(LOG_UPDATER_ERROR, 'ignored release-notes request for a non-https URL');
    return;
  }
  log.info(LOG_UPDATER_OPEN_RELEASE_NOTES, target);
  await shell.openExternal(target);
}
