/**
 * @fileoverview The EncodeX plan MCP App view (`ui://encodex/plan`).
 *
 * Renders a conversion plan from `recommend_settings` (profile, confidence,
 * rationale, and the exact `convert_media` arguments) and/or a size estimate
 * from `estimate_conversion` (size, duration, bitrates, hardware acceleration).
 * Both tools share this view, so it renders whichever payload it receives.
 * Self-contained (inline CSS + shared inline bridge); all values are written
 * with `textContent`.
 */

import { VIEW_BRIDGE_SCRIPT } from '../bridge';

/**
 * The self-contained plan view document.
 * @const {string}
 */
export const PLAN_VIEW_HTML = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>EncodeX plan</title>
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
      .card {
        padding: 14px;
        background: var(--color-background-primary, #ffffff);
        border: var(--border-width-regular, 1px) solid var(--encodex-border);
        border-radius: var(--encodex-radius);
      }
      .card + .card {
        margin-top: 12px;
      }
      .card[hidden] {
        display: none;
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
      h2 {
        margin: 14px 0 6px;
        font-size: var(--font-text-xs-size, 12px);
        font-weight: var(--font-weight-medium, 500);
        color: var(--encodex-muted);
        text-transform: uppercase;
        letter-spacing: 0.04em;
      }
      .badge {
        flex: none;
        padding: 2px 8px;
        border-radius: var(--border-radius-full, 999px);
        background: var(--color-background-tertiary, #e8e8ed);
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
      .rationale,
      .notes {
        margin: 0;
        padding: 0;
        list-style: none;
        display: grid;
        gap: 6px;
      }
      .rationale li,
      .notes li {
        padding-left: 18px;
        position: relative;
        overflow-wrap: anywhere;
      }
      .rationale li::before {
        content: '→';
        position: absolute;
        left: 0;
        color: var(--encodex-muted);
      }
      .notes li::before {
        content: '·';
        position: absolute;
        left: 4px;
        color: var(--encodex-muted);
      }
      .estimate {
        display: flex;
        flex-wrap: wrap;
        gap: 6px 18px;
        margin: 0;
        padding: 0;
        list-style: none;
      }
      .estimate li {
        color: var(--encodex-muted);
      }
      .estimate strong {
        color: var(--encodex-fg);
        font-weight: var(--font-weight-medium, 500);
      }
      .empty {
        padding: 24px 12px;
        text-align: center;
        color: var(--encodex-muted);
      }
    </style>
  </head>
  <body>
    <div class="card" id="plan-card" hidden>
      <header>
        <h1 id="plan-title">Conversion plan</h1>
        <span class="badge" id="plan-confidence"></span>
      </header>
      <ul class="rationale" id="plan-rationale"></ul>
      <h2>Settings</h2>
      <dl id="plan-args"></dl>
    </div>
    <div class="card" id="estimate-card" hidden>
      <header>
        <h1 id="estimate-title">Size estimate</h1>
        <span class="badge" id="estimate-badge">estimated</span>
      </header>
      <ul class="estimate">
        <li>Output <strong id="estimate-size">-</strong></li>
        <li>Duration <strong id="estimate-duration">-</strong></li>
        <li>Video <strong id="estimate-video">-</strong></li>
        <li>Audio <strong id="estimate-audio">-</strong></li>
        <li>Hardware <strong id="estimate-hw">-</strong></li>
      </ul>
      <h2 id="notes-title" hidden>Assumptions</h2>
      <ul class="notes" id="estimate-notes" hidden></ul>
    </div>
    <p class="empty" id="empty">Waiting for the host to provide a plan…</p>
    <script>
      window.__encodexView = (function () {
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
        function formatDuration(seconds) {
          var total = Math.max(0, Math.round(Number(seconds) || 0));
          var hours = Math.floor(total / 3600);
          var minutes = Math.floor((total % 3600) / 60);
          var secs = total % 60;
          var pad = function (n) { return n < 10 ? '0' + n : String(n); };
          return (hours > 0 ? hours + ':' : '') + pad(minutes) + ':' + pad(secs);
        }
        function label(key) {
          return String(key)
            .replace(/([a-z])([A-Z])/g, '$1 $2')
            .replace(/^./, function (c) { return c.toUpperCase(); });
        }
        function renderPlan(plan) {
          var card = document.getElementById('plan-card');
          card.hidden = false;
          document.getElementById('plan-title').textContent = plan.profileId || 'Conversion plan';
          var percent = Math.round(Math.max(0, Math.min(1, Number(plan.confidence) || 0)) * 100);
          document.getElementById('plan-confidence').textContent = percent + '% confidence';
          var rationale = document.getElementById('plan-rationale');
          rationale.textContent = '';
          var reasons = Array.isArray(plan.rationale) ? plan.rationale : [];
          for (var i = 0; i < reasons.length; i++) {
            var item = document.createElement('li');
            item.textContent = reasons[i];
            rationale.appendChild(item);
          }
          var args = document.getElementById('plan-args');
          args.textContent = '';
          var entries = plan.args && typeof plan.args === 'object' ? Object.keys(plan.args) : [];
          for (var e = 0; e < entries.length; e++) {
            var dt = document.createElement('dt');
            dt.textContent = label(entries[e]);
            var dd = document.createElement('dd');
            var value = plan.args[entries[e]];
            dd.textContent = value == null ? '' : String(value);
            args.appendChild(dt);
            args.appendChild(dd);
          }
        }
        function renderEstimate(estimate) {
          var card = document.getElementById('estimate-card');
          card.hidden = false;
          document.getElementById('estimate-size').textContent = formatSize(estimate.estimatedSizeBytes);
          document.getElementById('estimate-duration').textContent = formatDuration(estimate.estimatedDurationSeconds);
          document.getElementById('estimate-video').textContent = estimate.copy
            ? 'copy'
            : (Number(estimate.videoBitrateKbps) || 0) + ' kbps';
          document.getElementById('estimate-audio').textContent = estimate.copy
            ? 'copy'
            : (Number(estimate.audioBitrateKbps) || 0) + ' kbps';
          var hw = estimate.hardwareAcceleration || {};
          document.getElementById('estimate-hw').textContent = hw.available
            ? (Array.isArray(hw.methods) && hw.methods.length ? hw.methods.join(', ') : 'available')
            : 'software';
          var notes = document.getElementById('estimate-notes');
          notes.textContent = '';
          var list = Array.isArray(estimate.notes) ? estimate.notes : [];
          document.getElementById('notes-title').hidden = list.length === 0;
          notes.hidden = list.length === 0;
          for (var i = 0; i < list.length; i++) {
            var item = document.createElement('li');
            item.textContent = list[i];
            notes.appendChild(item);
          }
        }
        function render(payload) {
          var data = payload || {};
          var plan = data.plan ? data.plan : (data.providerId ? data : null);
          var estimate = data.estimate ? data.estimate : (data.method === 'bitrate' ? data : null);
          if (!plan && !estimate) return;
          document.getElementById('empty').hidden = true;
          if (plan) renderPlan(plan);
          if (estimate) renderEstimate(estimate);
        }
        return { appName: 'EncodeX plan view', render: render };
      })();
    </script>
    ${VIEW_BRIDGE_SCRIPT}
  </body>
</html>
`;
