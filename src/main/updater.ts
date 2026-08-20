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
 */

import { app, shell, BrowserWindow } from 'electron';
import * as https from 'https';
import * as fs from 'fs';
import * as path from 'path';
import { Logger } from '../shared/logger';
import type { UpdateInfo, UpdateAsset, UpdateProgress } from '../shared/types';
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
 * Compares two semver version strings numerically (ignoring pre-release suffixes).
 * Returns 1 if a > b, -1 if a < b, 0 if equal.
 *
 * @param {string} a - First version string (e.g. '1.2.0' or '1.2.0-beta.0').
 * @param {string} b - Second version string.
 * @returns {number} Comparison result.
 */
export function compareVersions(a: string, b: string): number {
  const strip = (v: string) => v.split('-')[0];
  const pa = strip(a).split('.').map(Number);
  const pb = strip(b).split('.').map(Number);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const na = pa[i] || 0;
    const nb = pb[i] || 0;
    if (na > nb) return 1;
    if (na < nb) return -1;
  }
  return 0;
}

/**
 * Selects the best-matching release asset for the current platform and architecture.
 *
 * @param {UpdateAsset[]} assets - Available release assets.
 * @returns {UpdateAsset | null} The matched asset, or null if none match.
 */
export function selectAsset(assets: UpdateAsset[]): UpdateAsset | null {
  const platform = process.platform;
  const arch = process.arch;

  let ext: string;
  if (platform === 'win32') ext = '.exe';
  else if (platform === 'darwin') ext = '.dmg';
  else ext = '.AppImage';

  const platformAssets = assets.filter((a) => a.name.toLowerCase().endsWith(ext));
  if (platformAssets.length === 0) return null;

  const archMatch = platformAssets.find((a) => a.name.toLowerCase().includes(arch));
  return archMatch || platformAssets[0];
}

/**
 * Performs a GET request to the GitHub Releases API and returns the parsed JSON.
 *
 * @returns {Promise<{ tag_name: string; body: string; html_url: string; assets: Array<{ name: string; browser_download_url: string; size: number }> }>}
 *   The latest release metadata.
 * @throws {Error} When the request fails or returns a non-200 status.
 */
function fetchLatestRelease(): Promise<{
  tag_name: string;
  body: string;
  html_url: string;
  assets: Array<{ name: string; browser_download_url: string; size: number }>;
} | null> {
  return new Promise((resolve, reject) => {
    const req = https.get(
      RELEASES_API_URL,
      {
        headers: {
          'User-Agent': `EncodeX/${app.getVersion()}`,
          Accept: 'application/vnd.github.v3+json',
        },
      },
      (res) => {
        if (res.statusCode === 404) {
          resolve(null);
          return;
        }
        if (res.statusCode !== 200) {
          reject(new Error(`GitHub API returned status ${res.statusCode}`));
          return;
        }
        let data = '';
        res.on('data', (chunk: Buffer) => {
          data += chunk.toString();
        });
        res.on('end', () => {
          try {
            resolve(JSON.parse(data));
          } catch (err) {
            reject(new Error(`Failed to parse GitHub API response: ${err}`));
          }
        });
      },
    );
    req.on('error', reject);
  });
}

/**
 * Checks for a new version by querying the GitHub Releases API.
 * Compares the remote tag against the local app version and returns update
 * info if a newer version exists with a matching platform asset.
 *
 * @returns {Promise<UpdateInfo | null>} Update information if available, or
 *   null when the app is up to date.
 * @throws {Error} When the network request or asset selection fails.
 */
export async function checkForUpdate(): Promise<UpdateInfo | null> {
  const currentVersion = app.getVersion();
  log.info(LOG_UPDATER_CHECKING, 'current:', currentVersion);

  const release = await fetchLatestRelease();
  if (!release) {
    log.info(LOG_UPDATER_NOT_AVAILABLE);
    return null;
  }
  const remoteVersion = release.tag_name.replace(/^v/, '');

  if (compareVersions(remoteVersion, currentVersion) <= 0) {
    log.info(LOG_UPDATER_NOT_AVAILABLE);
    return null;
  }

  const assets: UpdateAsset[] = release.assets.map((a) => ({
    name: a.name,
    url: a.browser_download_url,
    size: a.size,
  }));

  const asset = selectAsset(assets);
  if (!asset) {
    log.warn(LOG_UPDATER_ERROR, 'No matching asset for platform');
    return null;
  }

  const info: UpdateInfo = {
    version: remoteVersion,
    releaseNotes: release.body || '',
    releaseUrl: release.html_url,
    asset,
  };

  log.info(LOG_UPDATER_AVAILABLE, info.version, asset.name);
  return info;
}

/**
 * Returns the path to the update cache directory, creating it if necessary.
 *
 * @returns {string} Absolute path of the update directory.
 */
function getUpdateDir(): string {
  const dir = path.join(app.getPath('temp'), UPDATE_DIR_NAME);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
}

/**
 * Downloads a file from the given URL to the update directory, reporting
 * progress via the BrowserWindow's webContents.
 *
 * @param {string} url - The download URL.
 * @param {string} filename - The target filename.
 * @param {BrowserWindow} win - The main window for sending progress events.
 * @returns {Promise<string>} The absolute path of the downloaded file.
 * @throws {Error} When the download fails or is aborted.
 */
function downloadFile(url: string, filename: string, win: BrowserWindow): Promise<string> {
  return new Promise((resolve, reject) => {
    const destPath = path.join(getUpdateDir(), filename);
    activeAbortController = new AbortController();

    const req = https.get(
      url,
      {
        headers: { 'User-Agent': `EncodeX/${app.getVersion()}` },
        signal: activeAbortController.signal,
      },
      (res) => {
        if (res.statusCode === 302 || res.statusCode === 301) {
          downloadFile(res.headers.location!, filename, win).then(resolve, reject);
          return;
        }
        if (res.statusCode !== 200) {
          reject(new Error(`Download failed with status ${res.statusCode}`));
          return;
        }

        const totalBytes = Number(res.headers['content-length'] || 0);
        let transferredBytes = 0;
        let lastReportTime = 0;

        const fileStream = fs.createWriteStream(destPath);
        activeDownloadStream = fileStream;

        res.on('data', (chunk: Buffer) => {
          fileStream.write(chunk);
          transferredBytes += chunk.length;

          const now = Date.now();
          if (now - lastReportTime > 300 || transferredBytes === totalBytes) {
            lastReportTime = now;
            const progress: UpdateProgress = {
              percent: totalBytes > 0 ? Math.round((transferredBytes / totalBytes) * 100) : 0,
              transferred: transferredBytes,
              total: totalBytes,
            };
            if (!win.isDestroyed()) {
              win.webContents.send('update-progress', progress);
            }
          }
        });

        res.on('end', () => {
          fileStream.end(() => {
            activeDownloadStream = null;
            activeAbortController = null;
            resolve(destPath);
          });
        });

        res.on('error', (err) => {
          fileStream.end();
          activeDownloadStream = null;
          activeAbortController = null;
          reject(err);
        });
      },
    );

    req.on('error', (err) => {
      activeDownloadStream = null;
      activeAbortController = null;
      if ((err as Error).name === 'AbortError') {
        reject(new Error('Download cancelled'));
      } else {
        reject(err);
      }
    });
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
  const filePath = await downloadFile(info.asset.url, info.asset.name, win);
  log.info(LOG_UPDATER_DOWNLOADED, filePath);
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
  log.info(LOG_UPDATER_INSTALLING, installerPath);
  await shell.openPath(installerPath);
  app.quit();
}

/**
 * Opens the release notes page in the system browser.
 *
 * @param {string} url - The release page URL.
 * @returns {Promise<void>}
 */
export async function openReleaseNotes(url: string): Promise<void> {
  log.info(LOG_UPDATER_OPEN_RELEASE_NOTES, url);
  await shell.openExternal(url);
}
