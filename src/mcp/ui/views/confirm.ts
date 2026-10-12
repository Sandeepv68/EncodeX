/**
 * @fileoverview The generic EncodeX confirmation MCP App view
 * (`ui://encodex/confirm`).
 *
 * Rendered for every mutating tool except `convert_media` (which keeps its
 * richer form). It shows the operation the model proposed and refuses to run it
 * until the user clicks through, replaying the arguments into the app-only
 * `commit_operation` tool. Afterwards it tracks the resulting job(s) live.
 *
 * Self-contained (inline CSS + shared inline bridge); all user- and path-derived
 * strings are written with `textContent`.
 */

import { VIEW_BRIDGE_SCRIPT } from '../bridge';

/**
 * The self-contained confirmation view document.
 * @const {string}
 */
export const CONFIRM_VIEW_HTML = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>EncodeX confirm</title>
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
        text-transform: capitalize;
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
      .jobs {
        margin: 0;
        padding: 0;
        list-style: none;
        display: grid;
        gap: 6px;
      }
      .jobs li {
        display: flex;
        align-items: baseline;
        justify-content: space-between;
        gap: 12px;
        overflow: hidden;
      }
      .jobs .path {
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
    <div class="card" id="confirm">
      <h1 id="title">Confirm operation</h1>
      <p class="summary" id="summary"></p>
      <dl id="details"></dl>
      <ul class="warnings" id="warnings" hidden></ul>
      <button type="button" class="primary" id="run">Run</button>
      <p class="message" id="message" hidden></p>
    </div>
    <div class="card" id="progress" hidden>
      <header>
        <h1 id="p-title">Job</h1>
        <span class="status" id="p-status"></span>
      </header>
      <div class="bar" id="p-bar"><span id="p-fill"></span></div>
      <dl id="p-single">
        <dt>Output</dt>
        <dd id="p-output"></dd>
      </dl>
      <ul class="jobs" id="p-jobs" hidden></ul>
      <button type="button" class="cancel" id="cancel">Cancel</button>
    </div>
    <script>
      window.__encodexView = (function () {
        var currentJob = null;
        var currentConfirmation = null;
        var trackedJobId = null;
        var confirmTimer = null;
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
        function row(label, value) {
          var dt = document.createElement('dt');
          dt.textContent = label;
          var dd = document.createElement('dd');
          dd.textContent = value == null ? '' : String(value);
          return [dt, dd];
        }
        function renderConfirmation(confirmation) {
          if (!confirmation || typeof confirmation !== 'object') return;
          currentConfirmation = confirmation;
          document.getElementById('confirm').hidden = false;
          document.getElementById('progress').hidden = true;
          document.getElementById('title').textContent = confirmation.title || 'Confirm operation';
          document.getElementById('summary').textContent = confirmation.summary || '';
          var details = document.getElementById('details');
          details.textContent = '';
          var rows = Array.isArray(confirmation.details) ? confirmation.details : [];
          for (var i = 0; i < rows.length; i++) {
            if (!rows[i]) continue;
            var pair = row(rows[i].label, rows[i].value);
            details.appendChild(pair[0]);
            details.appendChild(pair[1]);
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
        function trackJob(job) {
          if (!job || !job.id || job.id === trackedJobId) return;
          trackedJobId = job.id;
          window.__encodexView.tool = 'get_job';
          window.__encodexView.arguments = { jobId: job.id };
          if (typeof window.__encodexStartPolling === 'function') window.__encodexStartPolling();
        }
        function renderJob(job) {
          if (!job || typeof job !== 'object') return;
          currentJob = job;
          document.getElementById('confirm').hidden = true;
          document.getElementById('progress').hidden = false;
          document.getElementById('p-bar').hidden = false;
          document.getElementById('p-jobs').hidden = true;
          var percent = Math.max(0, Math.min(100, Number(job.progress) || 0));
          document.getElementById('p-title').textContent = basename(job.output || job.input || job.id || 'Job');
          document.getElementById('p-status').textContent = String(job.status || 'queued') + ' - ' + Math.round(percent) + '%';
          document.getElementById('p-fill').style.width = percent + '%';
          document.getElementById('p-output').textContent = job.output || '';
          var cancel = document.getElementById('cancel');
          cancel.hidden = job.status === 'done' || job.status === 'error';
          cancel.onclick = requestCancel;
          trackJob(job);
        }
        function renderJobs(jobs) {
          document.getElementById('confirm').hidden = true;
          document.getElementById('progress').hidden = false;
          document.getElementById('p-bar').hidden = true;
          document.getElementById('p-jobs').hidden = false;
          document.getElementById('p-title').textContent = 'Queued jobs';
          document.getElementById('p-status').textContent = String(jobs.length) + ' job' + (jobs.length === 1 ? '' : 's');
          document.getElementById('cancel').hidden = true;
          var list = document.getElementById('p-jobs');
          list.textContent = '';
          for (var i = 0; i < jobs.length; i++) {
            var entry = jobs[i] || {};
            var item = document.createElement('li');
            var path = document.createElement('span');
            path.className = 'path';
            path.textContent = entry.output || entry.file || entry.jobId || '';
            var status = document.createElement('span');
            status.className = 'status';
            status.textContent = entry.status || '';
            item.appendChild(path);
            item.appendChild(status);
            list.appendChild(item);
          }
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
              document.getElementById('p-status').textContent = 'cancelled';
              button.hidden = true;
              if (window.__encodexView) window.__encodexView.tool = null;
            })
            .catch(function () {
              button.disabled = false;
              button.setAttribute('data-confirm', '0');
              button.textContent = 'Cancel';
            });
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
              if (structured && structured.job) {
                renderJob(structured.job);
              } else if (structured && Array.isArray(structured.jobs)) {
                renderJobs(structured.jobs);
              } else {
                message('The operation did not return a job.');
                button.disabled = false;
              }
            })
            .catch(function (error) {
              message('The operation failed: ' + (error && error.message ? error.message : 'unknown error'));
              button.disabled = false;
            });
        }
        function render(payload) {
          var data = payload || {};
          if (data.confirmation) {
            renderConfirmation(data.confirmation);
          } else if (data.job) {
            renderJob(data.job);
          } else if (Array.isArray(data.jobs)) {
            renderJobs(data.jobs);
          }
        }
        document.getElementById('run').onclick = run;
        return { appName: 'EncodeX confirm view', tool: null, autostart: false, intervalMs: 2000, render: render };
      })();
    </script>
    ${VIEW_BRIDGE_SCRIPT}
  </body>
</html>
`;
