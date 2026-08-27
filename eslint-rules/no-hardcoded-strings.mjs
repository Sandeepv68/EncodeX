/**
 * @fileoverview Custom ESLint rule that flags hardcoded English text intended for
 * the UI in the renderer.
 *
 * All user-facing copy should go through i18next (`useTranslation()` -> `t(...)` or
 * `i18n.t(...)`) so every surface is localizable. This rule reports visible JSX text
 * and string values on UI-copy props (label, placeholder, title, aria-*, alt,
 * helperText, ...) that contain English letters, as well as any English string
 * literal in a renderer file that is NOT the `key` argument of a translation call.
 *
 * Exemptions:
 *   - The `key` argument of a translation call (`t('app.name')`, `i18n.t('...')`).
 *   - Strings matching the allowlists (brand/product names, codecs, formats, etc.)
 *     — centralized in `text-allowlist.mjs` and overridable via rule options.
 *   - Object property values whose names are in `allowProps`.
 *   - Non-Latin text and strings with no A-Z/a-z letters.
 *   - Test files are excluded via the ESLint config override.
 *
 * Use `eslint-disable-next-line encodex/no-hardcoded-strings` for one-off cases.
 */

import { DEFAULT_ALLOW_TEXT, DEFAULT_ALLOW_PATTERNS, DEFAULT_ALLOW_PROPS } from './text-allowlist.mjs';

/** UI-copy prop names whose literal values are flagged by default. */
const DEFAULT_FLAG_PROPS = new Set([
  'label',
  'placeholder',
  'title',
  'aria-label',
  'aria-labelledby',
  'aria-placeholder',
  'aria-description',
  'aria-roledescription',
  'alt',
  'helperText',
  'helpertext',
  'description',
  'hint',
]);

/** Matches any English letter. */
const HAS_LETTER = /[A-Za-z]/;

/** Builds compiled RegExp objects from the allow pattern strings. */
function buildPatterns(patterns) {
  return patterns.map((pattern) => {
    // Allowlist entries already use a single `/` regex when we want exact-anchored
    // matching; otherwise treat them as unanchored substring regexes. Patterns are
    // matched case-insensitively because the allowlist is dominated by technical
    // identifiers (codecs, containers, formats) that are case-insensitive.
    const source = pattern.startsWith('^') ? pattern : `(?:${pattern})`;
    return new RegExp(source, 'i');
  });
}

export default {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Disallow hardcoded English UI text; use a translation key instead.',
    },
    messages: {
      hardcodedString:
        'Hardcoded UI text "{{text}}" found. Use a translation key via useTranslation() or i18n.t() instead (or add it to the allowlist if it should not be localized).',
    },
    schema: [
      {
        type: 'object',
        properties: {
          allowText: {
            type: 'array',
            items: { type: 'string' },
          },
          allowPatterns: {
            type: 'array',
            items: { type: 'string' },
          },
          allowProps: {
            type: 'array',
            items: { type: 'string' },
          },
          flagProps: {
            type: 'array',
            items: { type: 'string' },
          },
          ignoreFiles: {
            type: 'array',
            items: { type: 'string' },
          },
        },
        additionalProperties: false,
      },
    ],
  },
  create(context) {
    const options = context.options[0] || {};
    const ignoreFiles = new Set(options.ignoreFiles ?? []);
    const filename = context.filename || context.getFilename?.() || '';
    if (filename && [...ignoreFiles].some((glob) => filename.replace(/\\/g, '/').includes(glob))) {
      return {};
    }
    const allowText = new Set([...DEFAULT_ALLOW_TEXT, ...(options.allowText ?? [])]);
    const allowPatterns = buildPatterns([...DEFAULT_ALLOW_PATTERNS, ...(options.allowPatterns ?? [])]);
    const allowProps = new Set([...DEFAULT_ALLOW_PROPS, ...(options.allowProps ?? [])]);
    const flagProps = new Set([...DEFAULT_FLAG_PROPS, ...(options.flagProps ?? [])]);

    /** True when `text` should not be flagged (empty, non-Latin, or allowlisted). */
    function isAllowed(text) {
      if (!text || !HAS_LETTER.test(text)) return true;
      if (allowText.has(text)) return true;
      return allowPatterns.some((re) => re.test(text));
    }

    /**
     * Returns true when `node` lies within the `key` (first) argument of a
     * translation call, i.e. a CallExpression whose callee is named `t`. The key
     * may be a plain string, a template literal, or a conditional expression whose
     * branches are both key strings (`t(cond ? 'a' : 'b')`), so we walk the whole
     * ancestor chain for a matching call whose first argument subtree contains node.
     */
    function isTranslationKeyArg(node) {
      let current = node;
      while (current && current.parent) {
        const parent = current.parent;
        if (parent.type === 'CallExpression') {
          const callee = parent.callee;
          const isT =
            (callee.type === 'Identifier' && callee.name === 't') || (callee.type === 'MemberExpression' && callee.property?.name === 't');
          if (isT) {
            const firstArg = parent.arguments[0];
            if (firstArg && containsNode(firstArg, node)) return true;
          }
        }
        current = parent;
      }
      return false;
    }

    /** True when `ancestor` is `descendant` or contains it in its subtree. */
    function containsNode(ancestor, descendant) {
      if (ancestor === descendant) return true;
      if (!ancestor) return false;
      const keys = Object.keys(ancestor);
      for (const key of keys) {
        if (key === 'parent') continue;
        const value = ancestor[key];
        if (Array.isArray(value)) {
          if (value.some((item) => item && typeof item === 'object' && containsNode(item, descendant))) {
            return true;
          }
        } else if (value && typeof value === 'object' && containsNode(value, descendant)) {
          return true;
        }
      }
      return false;
    }

    /**
     * True when `node` is the DIRECT value of a UI-copy JSX attribute
     * (label=, placeholder=, aria-label=, ...) or the DIRECT value of a flagged
     * object property ({ label: 'x' }). "Direct" means the literal is the attribute
     * value itself (possibly via a single JSXExpressionContainer), so strings nested
     * deeper (e.g. helper-function arguments under a title= prop) are not flagged.
     */
    function isUiCopyContext(node) {
      if (!isDirectStringValue(node)) return false;

      // JSX attribute value: <X label="..." /> or <X label={'...'} />
      const parent = node.parent;
      if (parent.type === 'JSXAttribute') {
        const name = parent.name && parent.name.type === 'JSXIdentifier' ? parent.name.name : '';
        if (allowProps.has(name)) return false;
        return flagProps.has(name);
      }
      if (parent.type === 'JSXExpressionContainer') {
        const gp = parent.parent;
        if (gp && gp.type === 'JSXAttribute' && gp.value === parent) {
          const name = gp.name && gp.name.type === 'JSXIdentifier' ? gp.name.name : '';
          if (allowProps.has(name)) return false;
          return flagProps.has(name);
        }
      }

      // Object property value: { label: 'x' }
      if (parent.type === 'Property' && parent.value === node) {
        const key = parent.key;
        const name = key.type === 'Identifier' ? key.name : key.type === 'Literal' ? String(key.value) : '';
        if (allowProps.has(name)) return false;
        return flagProps.has(name);
      }

      return false;
    }

    /** True when `node` is a string Literal that is the direct value of its parent. */
    function isDirectStringValue(node) {
      if (node.type !== 'Literal') return false;
      const parent = node.parent;
      if (!parent) return false;
      if (parent.type === 'JSXAttribute' || parent.type === 'Property') {
        return parent.value === node;
      }
      if (parent.type === 'JSXExpressionContainer') {
        return parent.expression === node;
      }
      return false;
    }

    /** True when `node` is a JSXText that is a direct child (visible copy). */
    function isVisibleJsxText(node) {
      if (node.type !== 'JSXText') return false;
      const parent = node.parent;
      return parent && (parent.type === 'JSXElement' || parent.type === 'JSXFragment');
    }

    /** True when `node` is a Literal rendered as text inside JSX children `{...}`. */
    function isJsxChildrenLiteral(node) {
      if (node.type !== 'Literal') return false;
      const parent = node.parent;
      if (!parent || parent.type !== 'JSXExpressionContainer') return false;
      const grandparent = parent.parent;
      return (
        grandparent &&
        (grandparent.type === 'JSXElement' || grandparent.type === 'JSXFragment') &&
        Array.isArray(grandparent.children) &&
        grandparent.children.includes(parent)
      );
    }

    /** Reports if `node` is a hardcoded UI string in a context we care about. */
    function reportIfHardcoded(node, text) {
      if (isTranslationKeyArg(node)) return;
      if (isAllowed(text)) return;

      const uiCopy = isUiCopyContext(node);

      // Visible text rendered in JSX (either a text node or a `{...}` literal).
      if (isVisibleJsxText(node) || isJsxChildrenLiteral(node)) {
        context.report({ node, messageId: 'hardcodedString', data: { text } });
        return;
      }

      // String values on UI-copy props (label, placeholder, aria-label, ...).
      if (uiCopy) {
        context.report({ node, messageId: 'hardcodedString', data: { text } });
      }
    }

    return {
      JSXText(node) {
        reportIfHardcoded(node, node.value.trim());
      },
      Literal(node) {
        if (typeof node.value === 'string') reportIfHardcoded(node, node.value);
      },
      TemplateElement(node) {
        reportIfHardcoded(node, node.value.cooked ?? node.value.raw);
      },
    };
  },
};
