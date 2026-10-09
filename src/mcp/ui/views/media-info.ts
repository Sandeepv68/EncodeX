/**
 * @fileoverview The EncodeX media-info MCP App view (`ui://encodex/media-info`).
 *
 * Renders the `MediaInfo` returned by `get_media_info`: container summary plus a
 * per-stream table (codec, resolution/frame-rate, audio layout). Self-contained
 * (inline CSS + shared inline bridge); all probed values are written with
 * `textContent`.
 */

import { VIEW_BRIDGE_SCRIPT } from '../bridge';

/**
 * The self-contained media-info view document.
 * @const {string}
 */
export const MEDIA_INFO_VIEW_HTML = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>EncodeX media info</title>
    <style>
      :root {
        color-scheme: light dark;
        --encodex-bg: var(--color-background-secondary, #f5f5f7);
        --encodex-fg: var(--color-text-primary, #1d1d1f);
        --encodex-muted: var(--color-text-secondary, #6e6e73);
        --encodex-border: var(--color-border-primary, #d2d2d7);
        --encodex-radius: var(--border-radius-md, 10px);
      }
      * {
        box-sizing: border-box;
      }
      body {
        margin: 0;
        padding: 16px;
        font-family: var(--font-sans, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif);
        font-size: var(--font-text-sm-size, 14px);
        line-height: 1.45;
        color: var(--encodex-fg);
        background: var(--encodex-bg);
      }
      .card {
        padding: 14px;
        background: var(--color-background-primary, #ffffff);
        border: var(--border-width-regular, 1px) solid var(--encodex-border);
        border-radius: var(--encodex-radius);
      }
      h1 {
        margin: 0 0 2px;
        font-size: var(--font-heading-sm-size, 16px);
        font-weight: var(--font-weight-semibold, 600);
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .format {
        margin: 0 0 12px;
        color: var(--encodex-muted);
        font-size: var(--font-text-xs-size, 12px);
      }
      .facts {
        display: flex;
        flex-wrap: wrap;
        gap: 6px 18px;
        margin: 0 0 14px;
        padding: 0;
        list-style: none;
      }
      .facts li {
        color: var(--encodex-muted);
      }
      .facts strong {
        color: var(--encodex-fg);
        font-weight: var(--font-weight-medium, 500);
      }
      table {
        width: 100%;
        border-collapse: collapse;
      }
      th,
      td {
        text-align: left;
        padding: 6px 8px;
        border-bottom: var(--border-width-regular, 1px) solid var(--encodex-border);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      th {
        color: var(--encodex-muted);
        font-weight: var(--font-weight-medium, 500);
        font-size: var(--font-text-xs-size, 12px);
      }
      .empty {
        padding: 24px 12px;
        text-align: center;
        color: var(--encodex-muted);
      }
    </style>
  </head>
  <body>
    <div class="card" id="card" hidden>
      <h1 id="title">Media</h1>
      <p class="format" id="format"></p>
      <ul class="facts">
        <li>Duration <strong id="duration">-</strong></li>
        <li>Size <strong id="size">-</strong></li>
        <li>Bitrate <strong id="bitrate">-</strong></li>
      </ul>
      <table>
        <thead>
          <tr>
            <th>#</th>
            <th>Type</th>
            <th>Codec</th>
            <th>Details</th>
          </tr>
        </thead>
        <tbody id="streams"></tbody>
      </table>
    </div>
    <p class="empty" id="empty">Waiting for the host to provide media metadata…</p>
    <script>
      window.__encodexView = (function () {
        function basename(value) {
          var text = String(value || '');
          var slash = Math.max(text.lastIndexOf('/'), text.lastIndexOf('\\\\'));
          return slash >= 0 ? text.slice(slash + 1) : text;
        }
        function formatDuration(seconds) {
          var total = Math.max(0, Math.round(Number(seconds) || 0));
          var hours = Math.floor(total / 3600);
          var minutes = Math.floor((total % 3600) / 60);
          var secs = total % 60;
          var pad = function (n) { return n < 10 ? '0' + n : String(n); };
          return (hours > 0 ? hours + ':' : '') + pad(minutes) + ':' + pad(secs);
        }
        function formatSize(bytes) {
          var value = Number(bytes) || 0;
          var units = ['B', 'KB', 'MB', 'GB', 'TB'];
          var index = 0;
          while (value >= 1024 && index < units.length - 1) {
            value = value / 1024;
            index++;
          }
          return (index === 0 ? value : value.toFixed(value < 10 ? 1 : 0)) + ' ' + units[index];
        }
        function streamDetails(stream) {
          if (stream.type === 'video') {
            var resolution = stream.width && stream.height ? stream.width + ' x ' + stream.height : '';
            var fps = stream.frameRate ? stream.frameRate + ' fps' : '';
            return [resolution, fps, stream.pixelFormat].filter(Boolean).join(' - ');
          }
          if (stream.type === 'audio') {
            var rate = stream.sampleRate ? stream.sampleRate + ' Hz' : '';
            return [stream.channelLayout || (stream.channels ? stream.channels + ' ch' : ''), rate].filter(Boolean).join(' - ');
          }
          return stream.title || stream.language || '';
        }
        function renderRow(stream) {
          var row = document.createElement('tr');
          var cells = [String(stream.index), stream.type, stream.codec || '', streamDetails(stream)];
          for (var i = 0; i < cells.length; i++) {
            var cell = document.createElement('td');
            cell.textContent = cells[i];
            row.appendChild(cell);
          }
          return row;
        }
        function render(payload) {
          var media = payload && payload.media ? payload.media : payload;
          if (!media || typeof media !== 'object') return;
          var card = document.getElementById('card');
          var empty = document.getElementById('empty');
          if (!card || !empty) return;
          empty.hidden = true;
          card.hidden = false;
          document.getElementById('title').textContent = basename(media.file || 'Media');
          document.getElementById('format').textContent = media.formatLong || media.format || '';
          document.getElementById('duration').textContent = formatDuration(media.duration);
          document.getElementById('size').textContent = formatSize(media.size);
          document.getElementById('bitrate').textContent = media.bitrate || '-';
          var body = document.getElementById('streams');
          body.textContent = '';
          var streams = Array.isArray(media.streams) ? media.streams : [];
          for (var i = 0; i < streams.length; i++) body.appendChild(renderRow(streams[i]));
        }
        return { appName: 'EncodeX media-info view', render: render };
      })();
    </script>
    ${VIEW_BRIDGE_SCRIPT}
  </body>
</html>
`;
