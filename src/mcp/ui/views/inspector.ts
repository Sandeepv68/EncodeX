/**
 * @fileoverview The EncodeX inspector MCP App view (`ui://encodex/inspector`).
 *
 * Renders the `MediaAnalysis` returned by `analyze_media`: a one-line summary,
 * key facts (duration, size, resolution, codecs) and the ordered findings, each
 * tagged by severity, followed by the suggested next steps. Self-contained
 * (inline CSS + shared inline bridge); all probed values are written with
 * `textContent`.
 */

import { VIEW_BRIDGE_SCRIPT } from '../bridge';

/**
 * The self-contained inspector view document.
 * @const {string}
 */
export const INSPECTOR_VIEW_HTML = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>EncodeX inspector</title>
    <style>
      :root {
        color-scheme: light dark;
        --encodex-bg: var(--color-background-secondary, #f5f5f7);
        --encodex-fg: var(--color-text-primary, #1d1d1f);
        --encodex-muted: var(--color-text-secondary, #6e6e73);
        --encodex-border: var(--color-border-primary, #d2d2d7);
        --encodex-info: var(--color-background-info, #0a84ff);
        --encodex-warning: var(--color-text-warning, #b25000);
        --encodex-danger: var(--color-text-danger, #ff3b30);
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
      h2 {
        margin: 14px 0 6px;
        font-size: var(--font-text-xs-size, 12px);
        font-weight: var(--font-weight-medium, 500);
        color: var(--encodex-muted);
        text-transform: uppercase;
        letter-spacing: 0.04em;
      }
      .summary {
        margin: 0 0 12px;
        overflow-wrap: anywhere;
      }
      .facts {
        display: flex;
        flex-wrap: wrap;
        gap: 6px 18px;
        margin: 0;
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
      .findings,
      .steps {
        margin: 0;
        padding: 0;
        list-style: none;
        display: grid;
        gap: 8px;
      }
      .finding {
        padding: 8px 10px;
        border-left: 3px solid var(--encodex-border);
        border-radius: 4px;
        background: var(--color-background-secondary, #f5f5f7);
      }
      .finding[data-severity='info'] {
        border-left-color: var(--encodex-info);
      }
      .finding[data-severity='warning'] {
        border-left-color: var(--encodex-warning);
      }
      .finding[data-severity='error'] {
        border-left-color: var(--encodex-danger);
      }
      .finding .tag {
        font-size: var(--font-text-xs-size, 12px);
        color: var(--encodex-muted);
        text-transform: uppercase;
        letter-spacing: 0.04em;
      }
      .finding p {
        margin: 2px 0 0;
      }
      .steps li {
        padding-left: 18px;
        position: relative;
      }
      .steps li::before {
        content: '→';
        position: absolute;
        left: 0;
        color: var(--encodex-muted);
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
      <p class="summary" id="summary"></p>
      <ul class="facts">
        <li>Duration <strong id="duration">-</strong></li>
        <li>Size <strong id="size">-</strong></li>
        <li>Video <strong id="video">-</strong></li>
        <li>Audio <strong id="audio">-</strong></li>
      </ul>
      <h2>Findings</h2>
      <ul class="findings" id="findings"></ul>
      <h2 id="steps-title" hidden>Recommended next steps</h2>
      <ul class="steps" id="steps" hidden></ul>
    </div>
    <p class="empty" id="empty">Waiting for the host to provide an analysis…</p>
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
        function videoLabel(video) {
          if (!video || !video.codec) return '-';
          var resolution = video.width && video.height ? video.width + 'x' + video.height : '';
          var tags = [];
          if (video.hdr) tags.push('HDR');
          if (video.interlaced) tags.push('interlaced');
          return [video.codec, resolution].filter(Boolean).join(' ') + (tags.length ? ' (' + tags.join(', ') + ')' : '');
        }
        function audioLabel(audio) {
          if (!audio || !audio.codec) return '-';
          var layout = audio.channelLayout || (audio.channels ? audio.channels + ' ch' : '');
          return [audio.codec, layout].filter(Boolean).join(' ');
        }
        function renderFinding(finding) {
          var item = document.createElement('li');
          item.className = 'finding';
          item.setAttribute('data-severity', finding.severity || 'info');
          var tag = document.createElement('span');
          tag.className = 'tag';
          tag.textContent = finding.severity || 'info';
          var message = document.createElement('p');
          message.textContent = finding.message || '';
          item.appendChild(tag);
          item.appendChild(message);
          return item;
        }
        function render(payload) {
          var analysis = payload && payload.analysis ? payload.analysis : payload;
          if (!analysis || typeof analysis !== 'object') return;
          var card = document.getElementById('card');
          var empty = document.getElementById('empty');
          if (!card || !empty) return;
          empty.hidden = true;
          card.hidden = false;
          var facts = analysis.facts || {};
          document.getElementById('title').textContent = basename(analysis.file || 'Media');
          document.getElementById('summary').textContent = analysis.summary || '';
          document.getElementById('duration').textContent = formatDuration(facts.durationSeconds);
          document.getElementById('size').textContent = formatSize(facts.sizeBytes);
          document.getElementById('video').textContent = facts.hasVideo ? videoLabel(facts.video) : 'none';
          document.getElementById('audio').textContent = facts.hasAudio ? audioLabel(facts.audio) : 'none';
          var findings = document.getElementById('findings');
          findings.textContent = '';
          var list = Array.isArray(analysis.findings) ? analysis.findings : [];
          for (var i = 0; i < list.length; i++) findings.appendChild(renderFinding(list[i]));
          var steps = document.getElementById('steps');
          steps.textContent = '';
          var recommendations = Array.isArray(analysis.recommendations) ? analysis.recommendations : [];
          document.getElementById('steps-title').hidden = recommendations.length === 0;
          steps.hidden = recommendations.length === 0;
          for (var r = 0; r < recommendations.length; r++) {
            var step = document.createElement('li');
            step.textContent = recommendations[r];
            steps.appendChild(step);
          }
        }
        return { appName: 'EncodeX inspector view', render: render };
      })();
    </script>
    ${VIEW_BRIDGE_SCRIPT}
  </body>
</html>
`;
