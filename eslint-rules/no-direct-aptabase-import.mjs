/**
 * @fileoverview Custom ESLint rule that forbids importing `@aptabase/*` from
 * anywhere except the two adapter modules that own the SDK dependency.
 *
 * Aptabase must stay contained behind the provider-agnostic facade
 * (`src/shared/analytics/AnalyticsService.ts` + `events.ts`). Only the main
 * and renderer adapters (`src/main/analytics/aptabaseMainProvider.ts` and
 * `src/renderer/analytics/aptabaseRendererProvider.ts`) may import the SDK, so
 * swapping backends never requires touching call sites.
 *
 * Catches both static `import ... from '@aptabase/electron/...'` statements and
 * dynamic `import('@aptabase/electron/...')` expressions (the adapters use the
 * dynamic form to keep the SDK out of the static graph).
 */

/** Modules allowed to reach for the Aptabase SDK, keyed by normalized path. */
const ALLOWED_ADAPTERS = new Set([
  'src/main/analytics/aptabaseMainProvider.ts',
  'src/renderer/analytics/aptabaseRendererProvider.ts',
]);

/** True when the given filename resolves to an allowed adapter module. */
function isAllowedAdapter(filename) {
  if (!filename) return false;
  const normalized = filename.replace(/\\/g, '/');
  return [...ALLOWED_ADAPTERS].some((adapter) => normalized.endsWith(adapter));
}

export default {
  meta: {
    type: 'problem',
    docs: {
      description: 'Forbids @aptabase/* imports outside the two SDK adapter modules.',
    },
    messages: {
      directImport: 'Direct @aptabase/* import is only allowed inside the main/renderer Aptabase adapters.',
    },
  },
  create(context) {
    const filename = context.filename ?? context.getFilename?.();
    const allowed = isAllowedAdapter(filename);

    function checkSource(node, source) {
      if (allowed) return;
      if (source && typeof source.value === 'string' && source.value.startsWith('@aptabase/')) {
        context.report({ node, messageId: 'directImport' });
      }
    }

    return {
      ImportDeclaration(node) {
        checkSource(node, node.source);
      },
      ImportExpression(node) {
        checkSource(node, node.source);
      },
      CallExpression(node) {
        // Older parsers without ImportExpression node emit dynamic import as
        // `CallExpression(import(...))`; cover it defensively without
        // double-reporting when the source node is already an ImportExpression.
        if (node.callee && node.callee.type === 'Import') {
          checkSource(node, node.arguments[0]);
        }
      },
    };
  },
};