/**
 * @fileoverview The EncodeX workflow MCP App view (`ui://encodex/workflow`).
 *
 * Renders a workflow dry-run from `plan_workflow` (summary, ordered steps with
 * their dependencies, and any validation issues) and/or an execution report
 * from `execute_workflow` (per-step job id, status and output). Both tools share
 * this view, so it renders whichever payload it receives. Self-contained (inline
 * CSS + shared inline bridge); all values are written with `textContent`.
 */

import { VIEW_BRIDGE_SCRIPT } from '../bridge';

/**
 * The self-contained workflow view document.
 * @const {string}
 */
export const WORKFLOW_VIEW_HTML = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>EncodeX workflow</title>
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
        background: var(--color-background-success, #d1f4d9);
        color: var(--color-text-success, #1a7f37);
      }
      .badge.bad {
        background: var(--color-background-danger, #ffdadc);
        color: var(--color-text-danger, #c0392b);
      }
      ol.steps {
        margin: 0;
        padding: 0;
        list-style: none;
        display: grid;
        gap: 8px;
      }
      ol.steps li {
        display: grid;
        grid-template-columns: auto 1fr auto;
        align-items: center;
        gap: 10px;
      }
      .index {
        width: 22px;
        height: 22px;
        border-radius: var(--border-radius-full, 999px);
        background: var(--encodex-accent);
        color: #fff;
        font-size: var(--font-text-xs-size, 12px);
        text-align: center;
        line-height: 22px;
      }
      .step-id {
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .dep {
        color: var(--encodex-muted);
        font-size: var(--font-text-xs-size, 12px);
        white-space: nowrap;
      }
      .issues {
        margin: 0;
        padding: 0;
        list-style: none;
        display: grid;
        gap: 6px;
      }
      .issues li {
        padding-left: 18px;
        position: relative;
        overflow-wrap: anywhere;
        color: var(--color-text-danger, #c0392b);
      }
      .issues li::before {
        content: '!';
        position: absolute;
        left: 2px;
        font-weight: var(--font-weight-semibold, 600);
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
        <h1 id="plan-title">Workflow plan</h1>
        <span class="badge" id="plan-valid">valid</span>
      </header>
      <ol class="steps" id="plan-steps"></ol>
      <ul class="issues" id="plan-issues" hidden></ul>
    </div>
    <div class="card" id="result-card" hidden>
      <header>
        <h1 id="result-title">Workflow run</h1>
        <span class="badge" id="result-badge"></span>
      </header>
      <ol class="steps" id="result-steps"></ol>
    </div>
    <p class="empty" id="empty">Waiting for the host to provide a workflow…</p>
    <script>
      window.__encodexView = (function () {
        function clear(node) {
          while (node.firstChild) node.removeChild(node.firstChild);
        }
        function stepRow(index, primary, secondary) {
          var li = document.createElement('li');
          var badge = document.createElement('span');
          badge.className = 'index';
          badge.textContent = String(index + 1);
          var main = document.createElement('span');
          main.className = 'step-id';
          main.textContent = primary;
          var side = document.createElement('span');
          side.className = 'dep';
          side.textContent = secondary || '';
          li.appendChild(badge);
          li.appendChild(main);
          li.appendChild(side);
          return li;
        }
        function renderPlan(plan) {
          var card = document.getElementById('plan-card');
          card.hidden = false;
          document.getElementById('plan-title').textContent = plan.summary || 'Workflow plan';
          var badge = document.getElementById('plan-valid');
          badge.textContent = plan.valid ? 'valid' : 'invalid';
          badge.className = 'badge ' + (plan.valid ? 'ok' : 'bad');
          var steps = document.getElementById('plan-steps');
          clear(steps);
          var list = Array.isArray(plan.steps) ? plan.steps : [];
          for (var i = 0; i < list.length; i++) {
            var step = list[i];
            var deps = Array.isArray(step.dependsOn) && step.dependsOn.length ? 'needs ' + step.dependsOn.join(', ') : '';
            steps.appendChild(stepRow(i, step.tool + ' (' + step.id + ')', deps));
          }
          var issues = document.getElementById('plan-issues');
          clear(issues);
          var problems = Array.isArray(plan.issues) ? plan.issues : [];
          issues.hidden = problems.length === 0;
          for (var j = 0; j < problems.length; j++) {
            var item = document.createElement('li');
            item.textContent = problems[j].message;
            issues.appendChild(item);
          }
        }
        function renderResult(result) {
          var card = document.getElementById('result-card');
          card.hidden = false;
          var badge = document.getElementById('result-badge');
          var failed = result.failed;
          badge.textContent = failed ? 'failed' : 'completed';
          badge.className = 'badge ' + (failed ? 'bad' : 'ok');
          var steps = document.getElementById('result-steps');
          clear(steps);
          var list = Array.isArray(result.steps) ? result.steps : [];
          for (var i = 0; i < list.length; i++) {
            var step = list[i];
            var status = step.status || '';
            var output = step.output ? ' ' + step.output : '';
            steps.appendChild(stepRow(i, step.tool + ' (' + step.id + ')', status + output));
          }
        }
        function render(payload) {
          var data = payload || {};
          var plan = data.plan ? data.plan : (data.valid !== undefined || data.issues ? data : null);
          var result = data.result ? data.result : (data.steps && data.completed !== undefined ? data : null);
          if (!plan && !result) return;
          document.getElementById('empty').hidden = true;
          if (plan) renderPlan(plan);
          if (result) renderResult(result);
        }
        return { appName: 'EncodeX workflow view', render: render };
      })();
    </script>
    ${VIEW_BRIDGE_SCRIPT}
  </body>
</html>
`;
