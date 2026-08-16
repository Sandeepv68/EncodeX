/**
 * @fileoverview Custom ESLint rule that flags hardcoded CSS pixel (`px`) units
 * inside string literals and template literals.
 *
 * Pixel units must not be hardcoded; dimensions should scale with the root
 * font size via `theme.typography.pxToRem()` instead. The rule only inspects
 * string values (including template literal fragments), so comments and
 * plain-number MUI values are left alone.
 *
 * Some contexts legitimately require pixel units that cannot be derived from
 * `pxToRem()` (e.g. the IntersectionObserver `rootMargin` option). The optional
 * `allowProps` option lists object property names whose values are exempt;
 * `rootMargin` is allowed by default.
 */

/** Matches a numeric `px` unit, not preceded by a word char, dot, or hyphen. */
const PX_PATTERN = /(?:^|[^\w.-])(-?\d*\.?\d+px\b)/;

export default {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Disallow hardcoded px units; use theme.typography.pxToRem() instead.',
    },
    messages: {
      hardcodedPx: 'Hardcoded px unit "{{unit}}" found. Use theme.typography.pxToRem() instead.',
    },
    schema: [
      {
        type: 'object',
        properties: {
          allowProps: {
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
    const allowProps = new Set(options.allowProps ?? ['rootMargin']);

    /** Returns the nearest object-property key whose value subtree contains `node`, or null. */
    function ancestorPropertyKey(node) {
      let current = node;
      while (current && current.parent) {
        const parent = current.parent;
        if (parent.type === 'Property' && parent.value === current) {
          return parent.key;
        }
        current = parent;
      }
      return null;
    }

    function isExempt(node) {
      const key = ancestorPropertyKey(node);
      return key != null && key.type === 'Identifier' && allowProps.has(key.name);
    }

    function reportIfPx(node, text) {
      const match = text.match(PX_PATTERN);
      if (!match || isExempt(node)) return;
      context.report({
        node,
        messageId: 'hardcodedPx',
        data: { unit: match[1] },
      });
    }

    return {
      Literal(node) {
        if (typeof node.value === 'string') reportIfPx(node, node.value);
      },
      TemplateElement(node) {
        reportIfPx(node, node.value.raw);
      },
    };
  },
};
