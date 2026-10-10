/**
 * @fileoverview Inline MCP Apps client bridge for EncodeX views.
 *
 * MCP Apps views are host-sandboxed iframes that talk to the host with
 * JSON-RPC 2.0 over `postMessage`. This script is a minimal, dependency-free
 * implementation of that handshake plus the notifications EncodeX views consume:
 *
 *  - sends `ui/initialize`, then `ui/notifications/initialized`;
 *  - reports its content size with `ui/notifications/size-changed` (via a
 *    `ResizeObserver` and after every render) so hosts that size the iframe
 *    from the view — the default when `containerDimensions` is flexible or
 *    omitted — do not leave it at zero height;
 *  - applies host theme CSS variables from `ui/notifications/host-context-changed`;
 *  - calls the view's `render(structuredContent)` on `ui/notifications/tool-result`;
 *  - when the host proxies server tools, polls the view's tool via `tools/call`
 *    for auto-refresh;
 *  - exposes `window.__encodexCallTool(name, args)` and
 *    `window.__encodexStartPolling()` so views can act (submit forms, cancel
 *    jobs) and restart polling after learning their arguments;
 *  - leaves the static markup untouched in any host that never replies, so a
 *    plain HTML preview still renders.
 *
 * A view configures this bridge by defining `window.__encodexView` in an inline
 * script placed *before* this one:
 *
 *   window.__encodexView = {
 *     appName: 'EncodeX queue view',
 *     tool: 'list_jobs',            // optional: tool to poll for auto-refresh
 *     arguments: {},                // optional: tools/call arguments
 *     intervalMs: 2500,             // optional: poll interval
 *     autostart: true,              // optional: false to call __encodexStartPolling() later
 *     render: function (data) { ... }
 *   };
 *
 * It is inlined into every view document so the views stay self-contained
 * (zero network, CSP-clean) — the production target is a bundled React view
 * (Phase 1 pipeline B), which replaces this bridge with the ext-apps `App` API.
 *
 * The script intentionally avoids backticks so it can be embedded in the
 * surrounding HTML template literal without escaping.
 * @const {string}
 */
export const VIEW_BRIDGE_SCRIPT = `<script>
(function () {
  'use strict';
  var PROTOCOL_VERSION = '2026-01-26';
  var view = window.__encodexView || {};
  var nextId = 1;
  var pending = new Map();
  var polling = null;
  var lastSize = null;
  var sizeFrame = null;

  function send(message) {
    window.parent.postMessage(message, '*');
  }

  function request(method, params) {
    var id = nextId++;
    send({ jsonrpc: '2.0', id: id, method: method, params: params });
    return new Promise(function (resolve, reject) {
      pending.set(id, { resolve: resolve, reject: reject });
      setTimeout(function () {
        if (pending.has(id)) {
          pending.delete(id);
          reject(new Error('timeout: ' + method));
        }
      }, 15000);
    });
  }

  function notify(method, params) {
    send({ jsonrpc: '2.0', method: method, params: params || {} });
  }

  function reportSize() {
    var root = document.documentElement;
    if (!root) return;
    var previous = root.style.height;
    root.style.height = 'max-content';
    var height = Math.ceil(root.getBoundingClientRect().height);
    root.style.height = previous;
    var width = Math.ceil(window.innerWidth);
    if (lastSize && lastSize.width === width && lastSize.height === height) return;
    lastSize = { width: width, height: height };
    notify('ui/notifications/size-changed', { width: width, height: height });
  }

  function scheduleSizeReport() {
    if (sizeFrame !== null) return;
    if (typeof requestAnimationFrame === 'function') {
      sizeFrame = requestAnimationFrame(function () {
        sizeFrame = null;
        reportSize();
      });
    } else {
      reportSize();
    }
  }

  function setupSizeObserver() {
    scheduleSizeReport();
    if (typeof ResizeObserver === 'undefined') return;
    var observer = new ResizeObserver(function () {
      scheduleSizeReport();
    });
    observer.observe(document.documentElement);
    if (document.body) observer.observe(document.body);
  }

  function renderPayload(payload) {
    if (typeof view.render === 'function') view.render(payload || {});
    scheduleSizeReport();
  }

  function applyTheme(hostContext) {
    if (!hostContext) return;
    var variables = hostContext.styles && hostContext.styles.variables;
    if (variables) {
      Object.keys(variables).forEach(function (key) {
        if (variables[key]) document.documentElement.style.setProperty(key, variables[key]);
      });
    }
    if (hostContext.theme) document.documentElement.setAttribute('data-theme', hostContext.theme);
  }

  function startPolling() {
    if (!view.tool) return;
    if (polling) {
      clearInterval(polling);
      polling = null;
    }
    polling = setInterval(function () {
      request('tools/call', { name: view.tool, arguments: view.arguments || {} })
        .then(function (result) {
          if (result && result.structuredContent) renderPayload(result.structuredContent);
        })
        .catch(function () {
          clearInterval(polling);
          polling = null;
        });
    }, view.intervalMs || 2500);
  }

  window.__encodexStartPolling = startPolling;

  function callTool(name, args) {
    return request('tools/call', { name: name, arguments: args || {} });
  }

  window.__encodexCallTool = callTool;

  function handleMessage(event) {
    var message = event.data;
    if (!message || message.jsonrpc !== '2.0') return;
    if (message.id !== undefined && (message.result !== undefined || message.error !== undefined)) {
      var entry = pending.get(message.id);
      if (!entry) return;
      pending.delete(message.id);
      if (message.error) entry.reject(new Error(message.error.message || 'rpc error'));
      else entry.resolve(message.result);
      return;
    }
    if (message.method === 'ui/notifications/tool-result') {
      var params = message.params || {};
      if (params.structuredContent) renderPayload(params.structuredContent);
    } else if (message.method === 'ui/notifications/host-context-changed') {
      applyTheme(message.params);
    }
  }

  if (window.__encodexMessageListener) window.removeEventListener('message', window.__encodexMessageListener);
  window.__encodexMessageListener = handleMessage;
  window.addEventListener('message', handleMessage);

  function init() {
    request('ui/initialize', {
      appInfo: { name: view.appName || 'EncodeX view', version: '1.0.0' },
      appCapabilities: {},
      protocolVersion: PROTOCOL_VERSION,
    })
      .then(function (result) {
        applyTheme(result && result.hostContext);
        notify('ui/notifications/initialized');
        setupSizeObserver();
        if (result && result.hostCapabilities && result.hostCapabilities.serverTools && view.autostart !== false) startPolling();
      })
      .catch(function () {
        /* Not an MCP Apps host, or initialization timed out: keep static markup. */
      });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
</script>`;
