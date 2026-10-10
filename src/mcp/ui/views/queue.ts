/**
 * @fileoverview The EncodeX job-queue MCP App view.
 *
 * A self-contained HTML document served as the `ui://encodex/queue` resource.
 * It is deliberately dependency-free: no external scripts, styles, or fonts,
 * so it renders under the host's restrictive default CSP and works offline.
 * The view reads the host's theme from its CSS custom properties with safe
 * fallbacks.
 *
 * It renders the `structuredContent` returned by `list_jobs` (and re-renders on
 * each poll when the host proxies server tools) through the shared inline
 * bridge, {@link VIEW_BRIDGE_SCRIPT}. All job fields are written with
 * `textContent`, so untrusted file names cannot inject markup.
 */

import { VIEW_BRIDGE_SCRIPT } from '../bridge';

/**
 * The self-contained queue view document.
 * @const {string}
 */
export const QUEUE_VIEW_HTML = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>EncodeX queue</title>
    <style>
      :root {
        color-scheme: light dark;
        --encodex-bg: var(--color-background-secondary, #f5f5f7);
        --encodex-fg: var(--color-text-primary, #1d1d1f);
        --encodex-muted: var(--color-text-secondary, #6e6e73);
        --encodex-border: var(--color-border-primary, #d2d2d7);
        --encodex-accent: var(--color-background-info, #0a84ff);
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
      header {
        display: flex;
        align-items: baseline;
        justify-content: space-between;
        gap: 12px;
        margin-bottom: 12px;
      }
      h1 {
        margin: 0;
        font-size: var(--font-heading-sm-size, 16px);
        font-weight: var(--font-weight-semibold, 600);
      }
      .count {
        color: var(--encodex-muted);
        font-size: var(--font-text-xs-size, 12px);
      }
      ul {
        list-style: none;
        margin: 0;
        padding: 0;
        display: grid;
        gap: 8px;
      }
      li {
        display: grid;
        grid-template-columns: 1fr auto auto;
        align-items: center;
        gap: 4px 12px;
        padding: 10px 12px;
        background: var(--color-background-primary, #ffffff);
        border: var(--border-width-regular, 1px) solid var(--encodex-border);
        border-radius: var(--encodex-radius);
      }
      .name {
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .status {
        color: var(--encodex-muted);
        font-size: var(--font-text-xs-size, 12px);
        text-transform: capitalize;
      }
      .cancel {
        font: inherit;
        font-size: var(--font-text-xs-size, 12px);
        color: var(--encodex-fg);
        background: var(--color-background-tertiary, #e8e8ed);
        border: var(--border-width-regular, 1px) solid var(--encodex-border);
        border-radius: var(--border-radius-sm, 6px);
        padding: 2px 8px;
        cursor: pointer;
      }
      .cancel[data-confirm='1'] {
        color: var(--color-text-inverse, #ffffff);
        background: var(--color-background-danger, #ff3b30);
        border-color: transparent;
      }
      .cancel:disabled {
        opacity: 0.6;
        cursor: default;
      }
      .bar {
        grid-column: 1 / -1;
        height: 6px;
        border-radius: var(--border-radius-full, 999px);
        background: var(--color-background-tertiary, #e8e8ed);
        overflow: hidden;
      }
      .bar > span {
        display: block;
        height: 100%;
        width: 0;
        background: var(--encodex-accent);
        transition: width 240ms ease;
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
    <header>
      <h1>EncodeX queue</h1>
      <span class="count" id="count">Connecting…</span>
    </header>
    <ul id="jobs" hidden></ul>
    <p class="empty" id="empty">Waiting for the host to provide queue data…</p>
    <script>
      window.__encodexView = (function () {
        function basename(value) {
          var text = String(value || '');
          var slash = Math.max(text.lastIndexOf('/'), text.lastIndexOf('\\\\'));
          return slash >= 0 ? text.slice(slash + 1) : text;
        }
        function refresh() {
          return window.__encodexCallTool('list_jobs', {}).then(function (result) {
            if (result && result.structuredContent) render(result.structuredContent);
          });
        }
        function onCancel(job, button) {
          if (button.getAttribute('data-confirm') !== '1') {
            button.setAttribute('data-confirm', '1');
            button.textContent = 'Confirm';
            setTimeout(function () {
              if (button.isConnected && button.getAttribute('data-confirm') === '1') {
                button.setAttribute('data-confirm', '0');
                button.textContent = 'Cancel';
              }
            }, 4000);
            return;
          }
          button.disabled = true;
          window
            .__encodexCallTool('cancel_job', { jobId: job.id })
            .then(refresh)
            .catch(function () {
              button.disabled = false;
              button.textContent = 'Cancel';
              button.setAttribute('data-confirm', '0');
            });
        }
        function renderListItem(job) {
          var item = document.createElement('li');
          var name = document.createElement('span');
          name.className = 'name';
          name.textContent = basename(job.output || job.input || job.id);
          name.title = job.output || job.input || '';
          var status = document.createElement('span');
          status.className = 'status';
          var percent = Math.max(0, Math.min(100, Number(job.progress) || 0));
          status.textContent = String(job.status || 'queued') + ' - ' + Math.round(percent) + '%';
          var button = document.createElement('button');
          button.type = 'button';
          button.className = 'cancel';
          button.textContent = 'Cancel';
          button.addEventListener('click', function () {
            onCancel(job, button);
          });
          var bar = document.createElement('div');
          bar.className = 'bar';
          var fill = document.createElement('span');
          fill.style.width = percent + '%';
          bar.appendChild(fill);
          item.appendChild(name);
          item.appendChild(status);
          item.appendChild(button);
          item.appendChild(bar);
          return item;
        }
        function render(payload) {
          var list = document.getElementById('jobs');
          var empty = document.getElementById('empty');
          var count = document.getElementById('count');
          if (!list || !empty || !count) return;
          var jobs = payload && Array.isArray(payload.jobs) ? payload.jobs : [];
          count.textContent = jobs.length + (jobs.length === 1 ? ' job' : ' jobs');
          list.textContent = '';
          if (jobs.length === 0) {
            list.hidden = true;
            empty.hidden = false;
            empty.textContent = 'No jobs in the queue.';
            return;
          }
          empty.hidden = true;
          list.hidden = false;
          for (var i = 0; i < jobs.length; i++) list.appendChild(renderListItem(jobs[i]));
        }
        return { appName: 'EncodeX queue view', tool: 'list_jobs', intervalMs: 2500, render: render };
      })();
    </script>
    ${VIEW_BRIDGE_SCRIPT}
  </body>
</html>
`;
