/**
 * @fileoverview Custom ESLint rule that flags hardcoded CSS `rem` units
 * inside string literals and template literals.
 *
 * Rem values must not be hardcoded; dimensions should be derived from
 * `theme.typography.pxToRem()` so they scale with the root font size.
 * The rule only inspects string values (including template literal
 * fragments), so comments and plain-number MUI values are left alone.
 */

/** Matches a numeric `rem` unit, not preceded by a word char, dot, or hyphen. */
const REM_PATTERN = /(?:^|[^\w.-])(-?\d*\.?\d+rem\b)/;

export default {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Disallow hardcoded rem units; use theme.typography.pxToRem() instead.',
    },
    messages: {
      hardcodedRem: 'Hardcoded rem unit "{{unit}}" found. Use theme.typography.pxToRem() instead.',
    },
    schema: [],
  },
  create(context) {
    function reportIfRem(node, text) {
      const match = text.match(REM_PATTERN);
      if (!match) return;
      context.report({
        node,
        messageId: 'hardcodedRem',
        data: { unit: match[1] },
      });
    }

    return {
      Literal(node) {
        if (typeof node.value === 'string') reportIfRem(node, node.value);
      },
      TemplateElement(node) {
        reportIfRem(node, node.value.raw);
      },
    };
  },
};
