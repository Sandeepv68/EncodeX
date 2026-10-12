/**
 * @fileoverview The batch MCP App view (`ui://encodex/batch`).
 *
 * Serves `batch_convert`. Before the user approves, it shows the confirmation
 * card (file count, destination, warnings) and refuses to run until they click
 * through, replaying the arguments into the app-only `commit_operation` tool.
 * Afterwards it becomes a live dashboard over the shared job queue: aggregate
 * and per-file progress, status counts, and finish/error tallies. It polls
 * `list_jobs` and re-renders on every tool result.
 *
 * Self-contained (inline CSS + shared inline bridge); all user- and path-derived
 * strings are written with `textContent`.
 */

import { VIEW_BRIDGE_SCRIPT } from '../bridge';

/**
 * The self-contained batch view document.
 * @const {string}
 */
export const BATCH_VIEW_HTML = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>EncodeX batch</title>
    <style>
      :root {
        color-scheme: light dark;
        --encodex-bg: var(--color-background-secondary, #f5f5f7);
        --encodex-fg: var(--color-text-primary, #1d1d1f);
        --encodex-muted: var(--color-text-secondary, #6e6e73);
        --encodex-border: var(--color-border-primary, #d2d2d7);
        --encodex-accent: var(--color-background-info, #0a84ff);
        --encodex-danger: var(--color-text-danger, #ff3b30);
        --encodex-ok: var(--color-text-success, #34c759);
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
      .summary {
        margin: -6px 0 12px;
        color: var(--encodex-muted);
        overflow-wrap: anywhere;
      }
      header {
        display: flex;
        align-items: baseline;
        justify-content: space-between;
        gap: 12px;
        margin-bottom: 10px;
      }
      header h1 {
        margin: 0;
      }
      .status {
        color: var(--encodex-muted);
        font-size: var(--font-text-xs-size, 12px);
        white-space: nowrap;
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
      .warnings {
        margin: 12px 0 0;
        padding-left: 18px;
        color: var(--encodex-danger);
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
      button:disabled {
        opacity: 0.6;
        cursor: default;
      }
      .message {
        margin: 10px 0 0;
        color: var(--encodex-danger);
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
      .job {
        display: grid;
        gap: 4px;
        padding: 8px 0;
        border-top: var(--border-width-regular, 1px) solid var(--encodex-border);
      }
      .job:first-child {
        border-top: none;
      }
      .job .top {
        display: flex;
        align-items: baseline;
        justify-content: space-between;
        gap: 12px;
        overflow: hidden;
      }
      .job .path {
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .job .state {
        color: var(--encodex-muted);
        font-size: var(--font-text-xs-size, 12px);
        text-transform: capitalize;
        white-space: nowrap;
      }
      .job .state[data-state='done'] {
        color: var(--encodex-ok);
      }
      .job .state[data-state='error'] {
        color: var(--encodex-danger);
      }
      .job .bar {
        margin: 0;
        height: 6px;
      }
      @media (prefers-reduced-motion: reduce) {
        .bar > span {
          transition: none;
        }
      }
    </style>
  </head>
  <body>
    <div class="card" id="confirm">
      <h1 id="title">Confirm batch</h1>
      <p class="summary" id="summary"></p>
      <dl id="details"></dl>
      <ul class="warnings" id="warnings" hidden></ul>
      <button type="button" class="primary" id="run">Run batch</button>
      <p class="message" id="message" hidden></p>
    </div>
    <div class="card" id="dashboard" hidden>
      <header>
        <h1 id="d-title">Batch</h1>
        <span class="status" id="d-status"></span>
      </header>
      <div class="bar" id="d-bar"><span id="d-fill"></span></div>
      <div id="d-jobs"></div>
    </div>
    <script>
      window.__encodexView = (function () {
        var currentConfirmation = null;
        function basename(value) {
          var text = String(value || '');
          var slash = Math.max(text.lastIndexOf('/'), text.lastIndexOf('\\\\'));
          return slash >= 0 ? text.slice(slash + 1) : text;
        }
        function message(text) {
          var el = document.getElementById('message');
          if (!el) return;
          el.textContent = text || '';
          el.hidden = !text;
        }
        function renderConfirmation(confirmation) {
          if (!confirmation || typeof confirmation !== 'object') return;
          currentConfirmation = confirmation;
          document.getElementById('confirm').hidden = false;
          document.getElementById('dashboard').hidden = true;
          document.getElementById('title').textContent = confirmation.title || 'Confirm batch';
          document.getElementById('summary').textContent = confirmation.summary || '';
          var details = document.getElementById('details');
          details.textContent = '';
          var rows = Array.isArray(confirmation.details) ? confirmation.details : [];
          for (var i = 0; i < rows.length; i++) {
            if (!rows[i]) continue;
            var dt = document.createElement('dt');
            dt.textContent = rows[i].label || '';
            var dd = document.createElement('dd');
            dd.textContent = rows[i].value == null ? '' : String(rows[i].value);
            details.appendChild(dt);
            details.appendChild(dd);
          }
          var warnings = document.getElementById('warnings');
          warnings.textContent = '';
          var list = Array.isArray(confirmation.warnings) ? confirmation.warnings : [];
          warnings.hidden = list.length === 0;
          for (var w = 0; w < list.length; w++) {
            var item = document.createElement('li');
            item.textContent = list[w];
            warnings.appendChild(item);
          }
        }
        function renderDashboard(jobs) {
          document.getElementById('confirm').hidden = true;
          document.getElementById('dashboard').hidden = false;
          var list = Array.isArray(jobs) ? jobs : [];
          var done = 0;
          var errored = 0;
          var total = 0;
          var finished = 0;
          for (var i = 0; i < list.length; i++) {
            var status = String((list[i] && list[i].status) || 'queued');
            var progress = Math.max(0, Math.min(100, Number(list[i] && list[i].progress) || 0));
            total += progress;
            if (status === 'done') {
              done += 1;
              finished += 1;
            } else if (status === 'error' || status === 'cancelled') {
              if (status === 'error') errored += 1;
              finished += 1;
            }
          }
          var overall = finished === list.length && list.length > 0 ? 100 : list.length ? Math.round(total / list.length) : 0;
          document.getElementById('d-title').textContent = list.length + ' file' + (list.length === 1 ? '' : 's');
          document.getElementById('d-status').textContent = done + ' done' + (errored ? ' - ' + errored + ' failed' : '') + ' - ' + overall + '%';
          document.getElementById('d-fill').style.width = overall + '%';
          var container = document.getElementById('d-jobs');
          container.textContent = '';
          for (var j = 0; j < list.length; j++) {
            var job = list[j] || {};
            var row = document.createElement('div');
            row.className = 'job';
            var top = document.createElement('div');
            top.className = 'top';
            var path = document.createElement('span');
            path.className = 'path';
            path.textContent = basename(job.output || job.file || job.input || job.jobId || job.id || '');
            var state = document.createElement('span');
            state.className = 'state';
            state.setAttribute('data-state', String(job.status || 'queued'));
            var percent = Math.max(0, Math.min(100, Number(job.progress) || 0));
            state.textContent = String(job.status || 'queued') + ' - ' + Math.round(percent) + '%';
            top.appendChild(path);
            top.appendChild(state);
            var bar = document.createElement('div');
            bar.className = 'bar';
            var fill = document.createElement('span');
            fill.style.width = percent + '%';
            bar.appendChild(fill);
            row.appendChild(top);
            row.appendChild(bar);
            container.appendChild(row);
          }
        }
        function run() {
          if (!currentConfirmation) return;
          var button = document.getElementById('run');
          button.disabled = true;
          message('');
          window
            .__encodexCallTool('commit_operation', {
              tool: currentConfirmation.operation,
              args: currentConfirmation.args || {},
            })
            .then(function (result) {
              var structured = result && result.structuredContent ? result.structuredContent : null;
              if (structured && Array.isArray(structured.jobs)) {
                renderDashboard(structured.jobs);
              } else if (structured && structured.confirmation) {
                renderConfirmation(structured.confirmation);
                message('This batch changed and needs re-approval.');
                button.disabled = false;
                return;
              } else {
                renderDashboard([]);
              }
              window.__encodexView.tool = 'list_jobs';
              window.__encodexView.arguments = {};
              if (typeof window.__encodexStartPolling === 'function') window.__encodexStartPolling();
            })
            .catch(function (error) {
              message('The batch failed: ' + (error && error.message ? error.message : 'unknown error'));
              button.disabled = false;
            });
        }
        function render(payload) {
          var data = payload || {};
          if (data.confirmation) {
            renderConfirmation(data.confirmation);
          } else if (Array.isArray(data.jobs)) {
            renderDashboard(data.jobs);
          }
        }
        document.getElementById('run').onclick = run;
        return { appName: 'EncodeX batch view', tool: 'list_jobs', autostart: false, intervalMs: 2500, render: render };
      })();
    </script>
    ${VIEW_BRIDGE_SCRIPT}
  </body>
</html>
`;
