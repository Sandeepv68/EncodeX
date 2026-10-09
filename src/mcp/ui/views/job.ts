/**
 * @fileoverview The EncodeX single-job MCP App view (`ui://encodex/job`).
 *
 * Renders one conversion job returned by `get_job` or `convert_media`: status,
 * progress bar, input/output paths, and any error. Like every EncodeX view it is
 * self-contained (inline CSS + the shared inline bridge) and writes all
 * untrusted path data with `textContent`.
 */

import { VIEW_BRIDGE_SCRIPT } from '../bridge';

/**
 * The self-contained job view document.
 * @const {string}
 */
export const JOB_VIEW_HTML = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>EncodeX job</title>
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
      header {
        display: flex;
        align-items: baseline;
        justify-content: space-between;
        gap: 12px;
        margin-bottom: 10px;
      }
      h1 {
        margin: 0;
        font-size: var(--font-heading-sm-size, 16px);
        font-weight: var(--font-weight-semibold, 600);
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
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
      .error {
        margin: 12px 0 0;
        color: var(--encodex-danger);
        word-break: break-word;
      }
      .cancel {
        margin-top: 12px;
        font: inherit;
        font-size: var(--font-text-xs-size, 12px);
        color: var(--encodex-fg);
        background: var(--color-background-tertiary, #e8e8ed);
        border: var(--border-width-regular, 1px) solid var(--encodex-border);
        border-radius: var(--border-radius-sm, 6px);
        padding: 4px 12px;
        cursor: pointer;
      }
      .cancel[data-confirm='1'] {
        color: var(--color-text-inverse, #ffffff);
        background: var(--color-danger, #ff3b30);
        border-color: transparent;
      }
      .cancel:disabled {
        opacity: 0.6;
        cursor: default;
      }
      .empty {
        padding: 24px 12px;
        text-align: center;
        color: var(--encodex-muted);
      }
      @media (prefers-reduced-motion: reduce) {
        .bar > span {
          transition: none;
        }
      }
    </style>
  </head>
  <body>
    <div class="card" id="card" hidden>
      <header>
        <h1 id="title">Job</h1>
        <span class="status" id="status"></span>
      </header>
      <div class="bar"><span id="fill"></span></div>
      <dl>
        <dt>Input</dt>
        <dd id="input"></dd>
        <dt>Output</dt>
        <dd id="output"></dd>
      </dl>
      <button type="button" class="cancel" id="cancel">Cancel</button>
      <p class="error" id="error" hidden></p>
    </div>
    <p class="empty" id="empty">Waiting for the host to provide job data…</p>
    <script>
      window.__encodexView = (function () {
        function basename(value) {
          var text = String(value || '');
          var slash = Math.max(text.lastIndexOf('/'), text.lastIndexOf('\\\\'));
          return slash >= 0 ? text.slice(slash + 1) : text;
        }
        var currentJob = null;
        var confirmTimer = null;
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
        function render(payload) {
          var job = payload && payload.job ? payload.job : payload;
          if (!job || typeof job !== 'object') return;
          currentJob = job;
          var card = document.getElementById('card');
          var empty = document.getElementById('empty');
          if (!card || !empty) return;
          empty.hidden = true;
          card.hidden = false;
          var percent = Math.max(0, Math.min(100, Number(job.progress) || 0));
          document.getElementById('title').textContent = basename(job.output || job.input || job.id || 'Job');
          document.getElementById('status').textContent = String(job.status || 'queued') + ' - ' + Math.round(percent) + '%';
          document.getElementById('fill').style.width = percent + '%';
          var input = document.getElementById('input');
          input.textContent = job.input || '';
          input.title = job.input || '';
          var output = document.getElementById('output');
          output.textContent = job.output || '';
          output.title = job.output || '';
          var error = document.getElementById('error');
          if (job.error) {
            error.textContent = String(job.error);
            error.hidden = false;
          } else {
            error.hidden = true;
          }
          var cancelButton = document.getElementById('cancel');
          if (cancelButton) {
            cancelButton.hidden = job.status === 'done' || job.status === 'error';
            cancelButton.onclick = requestCancel;
          }
          if (job.id && (!window.__encodexView.arguments || window.__encodexView.arguments.jobId !== job.id)) {
            window.__encodexView.arguments = { jobId: job.id };
            if (typeof window.__encodexStartPolling === 'function') window.__encodexStartPolling();
          }
        }
        return { appName: 'EncodeX job view', tool: 'get_job', autostart: false, intervalMs: 2000, render: render };
      })();
    </script>
    ${VIEW_BRIDGE_SCRIPT}
  </body>
</html>
`;
