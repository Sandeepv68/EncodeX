/**
 * @fileoverview The EncodeX error MCP App view (`ui://encodex/error`).
 *
 * Renders the `ErrorExplanation` returned by `explain_error`: what went wrong,
 * the likely causes, and one-click fixes. Fixes that carry a tool call re-run the
 * operation with patched arguments (mutating fixes still pass through the normal
 * confirmation gate); informational fixes are shown as guidance. Self-contained
 * (inline CSS + shared inline bridge); all text is written with `textContent`.
 */

import { VIEW_BRIDGE_SCRIPT } from '../bridge';

/**
 * The self-contained error view document.
 * @const {string}
 */
export const ERROR_VIEW_HTML = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>EncodeX error</title>
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
      h1 {
        margin: 0 0 4px;
        font-size: var(--font-heading-sm-size, 16px);
        font-weight: var(--font-weight-semibold, 600);
      }
      .code {
        display: inline-block;
        margin: 0 0 10px;
        font-size: var(--font-text-xs-size, 12px);
        color: var(--encodex-danger);
        text-transform: uppercase;
        letter-spacing: 0.04em;
      }
      h2 {
        margin: 14px 0 6px;
        font-size: var(--font-text-xs-size, 12px);
        font-weight: var(--font-weight-medium, 500);
        color: var(--encodex-muted);
        text-transform: uppercase;
        letter-spacing: 0.04em;
      }
      .message {
        margin: 0;
        overflow-wrap: anywhere;
      }
      .detail {
        margin: 6px 0 0;
        color: var(--encodex-muted);
        font-size: var(--font-text-xs-size, 12px);
        overflow-wrap: anywhere;
      }
      ul {
        margin: 0;
        padding: 0;
        list-style: none;
        display: grid;
        gap: 8px;
      }
      .causes li {
        padding-left: 18px;
        position: relative;
        color: var(--encodex-muted);
      }
      .causes li::before {
        content: '•';
        position: absolute;
        left: 4px;
      }
      .fix {
        padding: 10px 12px;
        background: var(--color-background-secondary, #f5f5f7);
        border-radius: 6px;
      }
      .fix strong {
        display: block;
        font-weight: var(--font-weight-medium, 500);
      }
      .fix p {
        margin: 2px 0 0;
        color: var(--encodex-muted);
      }
      .fix button {
        margin-top: 8px;
        font: inherit;
        border-radius: var(--border-radius-sm, 6px);
        padding: 5px 12px;
        cursor: pointer;
        color: var(--color-text-inverse, #ffffff);
        background: var(--encodex-accent);
        border: none;
      }
      .fix button:disabled {
        opacity: 0.6;
        cursor: default;
      }
      .action {
        margin: 10px 0 0;
        color: var(--encodex-muted);
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
      <span class="code" id="code"></span>
      <h1 id="title">Error</h1>
      <p class="message" id="message"></p>
      <p class="detail" id="detail" hidden></p>
      <h2 id="causes-title" hidden>Likely causes</h2>
      <ul class="causes" id="causes" hidden></ul>
      <h2 id="fixes-title" hidden>Suggested fixes</h2>
      <ul id="fixes" hidden></ul>
      <p class="action" id="action" hidden></p>
    </div>
    <p class="empty" id="empty">Waiting for the host to provide an error…</p>
    <script>
      window.__encodexView = (function () {
        function renderFix(fix) {
          var item = document.createElement('li');
          item.className = 'fix';
          var label = document.createElement('strong');
          label.textContent = fix.label || '';
          var description = document.createElement('p');
          description.textContent = fix.description || '';
          item.appendChild(label);
          item.appendChild(description);
          if (fix.tool && fix.args && typeof window.__encodexCallTool === 'function') {
            var button = document.createElement('button');
            button.type = 'button';
            button.textContent = fix.kind === 'retry' ? 'Retry' : 'Apply fix';
            button.addEventListener('click', function () {
              button.disabled = true;
              var action = document.getElementById('action');
              window
                .__encodexCallTool(fix.tool, fix.args)
                .then(function (result) {
                  var structured = result && result.structuredContent ? result.structuredContent : null;
                  if (action) {
                    action.hidden = false;
                    action.textContent = structured && structured.confirmation ? 'Sent for confirmation: ' + fix.label : 'Requested: ' + fix.label;
                  }
                })
                .catch(function (error) {
                  if (action) {
                    action.hidden = false;
                    action.textContent = 'Could not apply the fix: ' + (error && error.message ? error.message : 'unknown error');
                  }
                  button.disabled = false;
                });
            });
            item.appendChild(button);
          }
          return item;
        }
        function render(payload) {
          var explanation = payload && payload.error ? payload.error : payload;
          if (!explanation || typeof explanation !== 'object' || !explanation.code) return;
          var card = document.getElementById('card');
          var empty = document.getElementById('empty');
          if (!card || !empty) return;
          empty.hidden = true;
          card.hidden = false;
          document.getElementById('code').textContent = explanation.code;
          document.getElementById('title').textContent = explanation.title || 'Error';
          document.getElementById('message').textContent = explanation.explanation || '';
          var detail = document.getElementById('detail');
          detail.textContent = explanation.detail || '';
          detail.hidden = !explanation.detail;
          var causes = Array.isArray(explanation.causes) ? explanation.causes : [];
          var causesList = document.getElementById('causes');
          causesList.textContent = '';
          document.getElementById('causes-title').hidden = causes.length === 0;
          causesList.hidden = causes.length === 0;
          for (var c = 0; c < causes.length; c++) {
            var cause = document.createElement('li');
            cause.textContent = causes[c];
            causesList.appendChild(cause);
          }
          var fixes = Array.isArray(explanation.fixes) ? explanation.fixes : [];
          var fixesList = document.getElementById('fixes');
          fixesList.textContent = '';
          document.getElementById('fixes-title').hidden = fixes.length === 0;
          fixesList.hidden = fixes.length === 0;
          for (var f = 0; f < fixes.length; f++) fixesList.appendChild(renderFix(fixes[f]));
        }
        return { appName: 'EncodeX error view', tool: null, autostart: false, render: render };
      })();
    </script>
    ${VIEW_BRIDGE_SCRIPT}
  </body>
</html>
`;
