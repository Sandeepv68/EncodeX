/**
 * @fileoverview The EncodeX compression-lab MCP App view (`ui://encodex/lab`).
 *
 * Renders the measured size-target loop from `compress_to_target`: the ceiling,
 * the size-derived candidate ladder, every attempt with its measured output
 * size, and which candidate (if any) actually fit. The winning size is a
 * measurement, not an estimate, so it is visually distinguished from the plan.
 * Self-contained (inline CSS + shared inline bridge); all values are written
 * with `textContent`.
 */

import { VIEW_BRIDGE_SCRIPT } from '../bridge';

/**
 * The self-contained compression-lab view document.
 * @const {string}
 */
export const LAB_VIEW_HTML = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>EncodeX compression lab</title>
    <style>
      :root {
        color-scheme: light dark;
        --encodex-bg: var(--color-background-secondary, #f5f5f7);
        --encodex-fg: var(--color-text-primary, #1d1d1f);
        --encodex-muted: var(--color-text-secondary, #6e6e73);
        --encodex-border: var(--color-border-primary, #d2d2d7);
        --encodex-accent: var(--color-background-info, #0a84ff);
        --encodex-ok: #1a7f37;
        --encodex-bad: #b42318;
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
      .badge.ok {
        color: var(--encodex-ok);
      }
      .badge.bad {
        color: var(--encodex-bad);
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
      table {
        width: 100%;
        border-collapse: collapse;
      }
      th,
      td {
        text-align: left;
        padding: 4px 8px 4px 0;
        border-bottom: var(--border-width-regular, 1px) solid var(--encodex-border);
      }
      th {
        color: var(--encodex-muted);
        font-weight: var(--font-weight-medium, 500);
        font-size: var(--font-text-xs-size, 12px);
      }
      td.fit {
        color: var(--encodex-ok);
        font-weight: var(--font-weight-medium, 500);
      }
      ul.notes {
        margin: 0;
        padding: 0;
        list-style: none;
        display: grid;
        gap: 6px;
      }
      ul.notes li {
        padding-left: 18px;
        position: relative;
        overflow-wrap: anywhere;
      }
      ul.notes li::before {
        content: '·';
        position: absolute;
        left: 4px;
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
    <div class="card" id="summary-card" hidden>
      <header>
        <h1 id="lab-title">Compression lab</h1>
        <span class="badge" id="lab-badge"></span>
      </header>
      <dl id="lab-summary"></dl>
    </div>
    <div class="card" id="chosen-card" hidden>
      <header>
        <h1 id="chosen-title">Best measured fit</h1>
        <span class="badge ok" id="chosen-badge">measured</span>
      </header>
      <dl id="chosen-details"></dl>
    </div>
    <div class="card" id="attempts-card" hidden>
      <h2>Attempts</h2>
      <table>
        <thead>
          <tr>
            <th>#</th>
            <th>Video</th>
            <th>Output</th>
            <th>Fits</th>
          </tr>
        </thead>
        <tbody id="attempts-body"></tbody>
      </table>
    </div>
    <div class="card" id="plan-card" hidden>
      <h2>Candidate ladder</h2>
      <ul class="notes" id="plan-notes"></ul>
    </div>
    <p class="empty" id="empty">Waiting for the host to provide a compression result…</p>
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
        function row(list, label, value) {
          var dt = document.createElement('dt');
          dt.textContent = label;
          var dd = document.createElement('dd');
          dd.textContent = value == null ? '' : String(value);
          list.appendChild(dt);
          list.appendChild(dd);
        }
        function render(data) {
          var lab = data.lab ? data.lab : (data.attempts ? data : null);
          if (!lab) return;
          document.getElementById('empty').hidden = true;

          var badge = document.getElementById('lab-badge');
          if (lab.converged) {
            badge.textContent = 'fits';
            badge.className = 'badge ok';
          } else {
            badge.textContent = 'no fit';
            badge.className = 'badge bad';
          }

          var summary = document.getElementById('lab-summary');
          summary.textContent = '';
          row(summary, 'Input', lab.input);
          row(summary, 'Ceiling', formatSize(lab.maxBytes));
          row(summary, 'Video codec', lab.videoCodec);
          row(summary, 'Audio codec', lab.audioCodec);
          document.getElementById('summary-card').hidden = false;

          if (lab.chosen) {
            var details = document.getElementById('chosen-details');
            details.textContent = '';
            row(details, 'Video bitrate', (Number(lab.chosen.videoBitrateKbps) || 0) + ' kbps');
            row(details, 'Audio bitrate', (Number(lab.chosen.audioBitrateKbps) || 0) + ' kbps');
            row(details, 'Measured size', formatSize(lab.chosen.sizeBytes));
            row(details, 'Output', lab.chosen.output);
            document.getElementById('chosen-card').hidden = false;
          }

          var attempts = Array.isArray(lab.attempts) ? lab.attempts : [];
          if (attempts.length) {
            var body = document.getElementById('attempts-body');
            body.textContent = '';
            for (var i = 0; i < attempts.length; i++) {
              var attempt = attempts[i] || {};
              var tr = document.createElement('tr');
              var cells = [
                attempt.candidate || String(i + 1),
                (Number(attempt.videoBitrateKbps) || 0) + ' kbps',
                typeof attempt.sizeBytes === 'number' ? formatSize(attempt.sizeBytes) : (attempt.status || ''),
              ];
              for (var c = 0; c < cells.length; c++) {
                var td = document.createElement('td');
                td.textContent = cells[c];
                tr.appendChild(td);
              }
              var fit = document.createElement('td');
              fit.textContent = attempt.fits ? 'yes' : 'no';
              if (attempt.fits) fit.className = 'fit';
              tr.appendChild(fit);
              body.appendChild(tr);
            }
            document.getElementById('attempts-card').hidden = false;
          }

          var plan = lab.plan || {};
          var notes = document.getElementById('plan-notes');
          notes.textContent = '';
          if (Number(plan.baselineVideoKbps)) {
            var baseline = document.createElement('li');
            baseline.textContent = 'Size-derived baseline: ' + plan.baselineVideoKbps + ' kbps video at ' +
              (Number(plan.audioBitrateKbps) || 0) + ' kbps audio.';
            notes.appendChild(baseline);
          }
          var candidates = Array.isArray(plan.candidates) ? plan.candidates : [];
          for (var k = 0; k < candidates.length; k++) {
            var item = document.createElement('li');
            item.textContent = candidates[k].videoBitrateKbps + ' kbps (' +
              candidates[k].percentOfBaseline + '%) — ' + candidates[k].rationale;
            notes.appendChild(item);
          }
          var caveats = Array.isArray(plan.notes) ? plan.notes : [];
          for (var n = 0; n < caveats.length; n++) {
            var note = document.createElement('li');
            note.textContent = caveats[n];
            notes.appendChild(note);
          }
          document.getElementById('plan-card').hidden = notes.childElementCount === 0;
        }
        return { appName: 'EncodeX compression lab view', render: render };
      })();
    </script>
    ${VIEW_BRIDGE_SCRIPT}
  </body>
</html>
`;
