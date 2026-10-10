/**
 * @fileoverview The EncodeX conversion MCP App view (`ui://encodex/convert`).
 *
 * A setup form that calls the app-only `commit_operation` from within the view
 * (via the host's `tools/call` proxy) and then tracks the resulting job,
 * polling `get_job` for live progress with a confirm-gated cancel. When the
 * model proposes a conversion the host delivers it as a confirmation and the
 * form is pre-filled for the user to review and start.
 *
 * Self-contained (inline CSS + shared inline bridge); all user- and path-derived
 * strings are written with `textContent`.
 */

import { VIEW_BRIDGE_SCRIPT } from '../bridge';

/**
 * The self-contained convert view document.
 * @const {string}
 */
export const CONVERT_VIEW_HTML = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>EncodeX convert</title>
    <style>
      :root {
        color-scheme: light dark;
        --encodex-bg: var(--color-background-secondary, #f5f5f7);
        --encodex-fg: var(--color-text-primary, #1d1d1f);
        --encodex-muted: var(--color-text-secondary, #6e6e73);
        --encodex-border: var(--color-border-primary, #d2d2d7);
        --encodex-accent: var(--color-background-info, #0a84ff);
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
      .card + .card {
        margin-top: 12px;
      }
      h1 {
        margin: 0 0 12px;
        font-size: var(--font-heading-sm-size, 16px);
        font-weight: var(--font-weight-semibold, 600);
      }
      .grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
        gap: 10px 12px;
      }
      label {
        display: grid;
        gap: 3px;
        color: var(--encodex-muted);
        font-size: var(--font-text-xs-size, 12px);
      }
      input[type='text'],
      input[type='number'] {
        font: inherit;
        color: var(--encodex-fg);
        background: var(--color-background-secondary, #f5f5f7);
        border: var(--border-width-regular, 1px) solid var(--encodex-border);
        border-radius: var(--border-radius-sm, 6px);
        padding: 6px 8px;
      }
      .check {
        display: flex;
        flex-direction: row;
        align-items: center;
        gap: 8px;
        margin-top: 12px;
        color: var(--encodex-fg);
      }
      button {
        font: inherit;
        border-radius: var(--border-radius-sm, 6px);
        padding: 6px 14px;
        cursor: pointer;
      }
      .primary {
        margin-top: 12px;
        color: var(--color-text-inverse, #ffffff);
        background: var(--encodex-accent);
        border: none;
      }
      .cancel {
        margin-top: 12px;
        font-size: var(--font-text-xs-size, 12px);
        color: var(--encodex-fg);
        background: var(--color-background-tertiary, #e8e8ed);
        border: var(--border-width-regular, 1px) solid var(--encodex-border);
      }
      .cancel[data-confirm='1'] {
        color: var(--color-text-inverse, #ffffff);
        background: var(--encodex-danger);
        border-color: transparent;
      }
      button:disabled {
        opacity: 0.6;
        cursor: default;
      }
      .message {
        margin: 10px 0 0;
        color: var(--encodex-danger);
      }
      .proposal {
        margin: 0 0 12px;
        color: var(--encodex-muted);
      }
      header {
        display: flex;
        align-items: baseline;
        justify-content: space-between;
        gap: 12px;
        margin-bottom: 10px;
      }
      .status {
        color: var(--encodex-muted);
        font-size: var(--font-text-xs-size, 12px);
        text-transform: capitalize;
        white-space: nowrap;
      }
      .bar {
        height: 8px;
        border-radius: var(--border-radius-full, 999px);
        background: var(--color-background-tertiary, #e8e8ed);
        overflow: hidden;
        margin: 0 0 12px;
      }
      .bar > span {
        display: block;
        height: 100%;
        width: 0;
        background: var(--encodex-accent);
        transition: width 240ms ease;
      }
      dl {
        margin: 0;
        display: grid;
        grid-template-columns: auto 1fr;
        gap: 4px 12px;
      }
      dt {
        color: var(--encodex-muted);
      }
      dd {
        margin: 0;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      @media (prefers-reduced-motion: reduce) {
        .bar > span {
          transition: none;
        }
      }
    </style>
  </head>
  <body>
    <div class="card">
      <h1>New conversion</h1>
      <p class="proposal" id="proposal" hidden></p>
      <div class="grid">
        <label>Input <input type="text" id="input" placeholder="Absolute input path" /></label>
        <label>Output <input type="text" id="output" placeholder="Derived when empty" /></label>
        <label>Video codec <input type="text" id="videoCodec" placeholder="libx264 / copy" /></label>
        <label>Audio codec <input type="text" id="audioCodec" placeholder="aac / copy" /></label>
        <label>Video bitrate <input type="text" id="videoBitrate" placeholder="2000k" /></label>
        <label>Audio bitrate <input type="text" id="audioBitrate" placeholder="192k" /></label>
        <label>Quality (1-31) <input type="number" id="qscale" min="1" max="31" /></label>
        <label>Scale <input type="text" id="scale" placeholder="1280:-2" /></label>
      </div>
      <label class="check"><input type="checkbox" id="copy" /> Lossless stream copy</label>
      <button type="button" class="primary" id="submit">Start conversion</button>
      <p class="message" id="message" hidden></p>
    </div>
    <div class="card" id="result" hidden>
      <header>
        <h1 id="title">Job</h1>
        <span class="status" id="status"></span>
      </header>
      <div class="bar"><span id="fill"></span></div>
      <dl>
        <dt>Input</dt>
        <dd id="r-input"></dd>
        <dt>Output</dt>
        <dd id="r-output"></dd>
      </dl>
      <button type="button" class="cancel" id="cancel">Cancel</button>
    </div>
    <script>
      window.__encodexView = (function () {
        var currentJob = null;
        var confirmTimer = null;
        function basename(value) {
          var text = String(value || '');
          var slash = Math.max(text.lastIndexOf('/'), text.lastIndexOf('\\\\'));
          return slash >= 0 ? text.slice(slash + 1) : text;
        }
        function value(id) {
          var el = document.getElementById(id);
          return el ? String(el.value || '').trim() : '';
        }
        function collect() {
          var args = {};
          var fields = ['input', 'output', 'videoCodec', 'audioCodec', 'videoBitrate', 'audioBitrate', 'scale'];
          for (var i = 0; i < fields.length; i++) {
            var current = value(fields[i]);
            if (current) args[fields[i]] = current;
          }
          var qscale = value('qscale');
          if (qscale) args.qscale = Number(qscale);
          var copy = document.getElementById('copy');
          if (copy && copy.checked) args.copy = true;
          return args;
        }
        function message(text) {
          var el = document.getElementById('message');
          if (!el) return;
          el.textContent = text || '';
          el.hidden = !text;
        }
        function trackJob(job) {
          if (!job || !job.id) return;
          window.__encodexView.arguments = { jobId: job.id };
          if (typeof window.__encodexStartPolling === 'function') window.__encodexStartPolling();
        }
        function renderJob(job) {
          if (!job || typeof job !== 'object') return;
          currentJob = job;
          document.getElementById('result').hidden = false;
          var percent = Math.max(0, Math.min(100, Number(job.progress) || 0));
          document.getElementById('title').textContent = basename(job.output || job.input || job.id || 'Job');
          document.getElementById('status').textContent = String(job.status || 'queued') + ' - ' + Math.round(percent) + '%';
          document.getElementById('fill').style.width = percent + '%';
          document.getElementById('r-input').textContent = job.input || '';
          document.getElementById('r-output').textContent = job.output || '';
          var cancel = document.getElementById('cancel');
          cancel.hidden = job.status === 'done' || job.status === 'error';
          cancel.onclick = requestCancel;
        }
        function requestCancel() {
          var button = document.getElementById('cancel');
          if (!button || !currentJob) return;
          if (button.getAttribute('data-confirm') !== '1') {
            button.setAttribute('data-confirm', '1');
            button.textContent = 'Confirm cancel';
            confirmTimer = setTimeout(function () {
              button.setAttribute('data-confirm', '0');
              button.textContent = 'Cancel';
            }, 4000);
            return;
          }
          if (confirmTimer) clearTimeout(confirmTimer);
          button.disabled = true;
          window
            .__encodexCallTool('cancel_job', { jobId: currentJob.id })
            .then(function () {
              document.getElementById('status').textContent = 'cancelled';
              button.hidden = true;
              if (window.__encodexView) window.__encodexView.tool = null;
            })
            .catch(function () {
              button.disabled = false;
              button.setAttribute('data-confirm', '0');
              button.textContent = 'Cancel';
            });
        }
        function start() {
          var args = collect();
          if (!args.input) {
            message('An input path is required.');
            return;
          }
          var button = document.getElementById('submit');
          button.disabled = true;
          message('');
          window
            .__encodexCallTool('commit_operation', { tool: 'convert_media', args: args })
            .then(function (result) {
              var job = result && result.structuredContent ? result.structuredContent.job : null;
              if (job) {
                renderJob(job);
                trackJob(job);
              } else {
                message('The conversion did not return a job.');
              }
            })
            .catch(function (error) {
              message('Conversion failed: ' + (error && error.message ? error.message : 'unknown error'));
            })
            .then(function () {
              button.disabled = false;
            });
        }
        function prefill(confirmation) {
          var args = confirmation && confirmation.args ? confirmation.args : {};
          var fields = ['input', 'output', 'videoCodec', 'audioCodec', 'videoBitrate', 'audioBitrate', 'scale'];
          for (var i = 0; i < fields.length; i++) {
            var el = document.getElementById(fields[i]);
            if (el && args[fields[i]] !== undefined && args[fields[i]] !== null) el.value = String(args[fields[i]]);
          }
          var qscale = document.getElementById('qscale');
          if (qscale && args.qscale !== undefined && args.qscale !== null) qscale.value = String(args.qscale);
          var copy = document.getElementById('copy');
          if (copy && args.copy) copy.checked = true;
          var note = document.getElementById('proposal');
          if (note) {
            note.textContent =
              (confirmation.summary ? confirmation.summary + ' - ' : '') + 'review the settings, then start the conversion.';
            note.hidden = false;
          }
        }
        function render(payload) {
          if (payload && payload.confirmation) {
            prefill(payload.confirmation);
            return;
          }
          var job = payload && payload.job ? payload.job : payload;
          renderJob(job);
          trackJob(job);
        }
        document.getElementById('submit').onclick = start;
        return { appName: 'EncodeX convert view', tool: 'get_job', autostart: false, intervalMs: 2000, render: render };
      })();
    </script>
    ${VIEW_BRIDGE_SCRIPT}
  </body>
</html>
`;
