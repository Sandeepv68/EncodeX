/**
 * @fileoverview Custom ESLint rule that flags hardcoded color codes (hex, rgb,
 * rgba, hsl, hsla, hwb) inside string literals and template literals.
 *
 * Colors must not be written inline; they should reference the shared color
 * constants in `src/renderer/colors.ts` (COLORS, OVERLAY_COLORS, TIMELINE_COLORS,
 * the theme palettes, etc.) so every surface stays themeable and consistent.
 *
 * The rule only inspects string values, so comments and the definitions inside
 * the constants file itself are left alone (the constants file is exempted in
 * the ESLint config). CSS color keywords that are not "codes" (e.g. `inherit`,
 * `transparent`, `currentColor`) are intentionally not flagged.
 */

/** Matches a hex color code or a css color function call. */
const COLOR_PATTERN = /(?:#[0-9a-fA-F]{3,4}\b|#[0-9a-fA-F]{6,8}\b|(?:rgba?|hsla?|hwba?)\([^)]*\))/g;

export default {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Disallow hardcoded color codes; reference the color constants instead.',
    },
    messages: {
      hardcodedColor: 'Hardcoded color "{{color}}" found. Reference it from the color constants (src/renderer/colors.ts) instead.',
    },
    schema: [],
  },
  create(context) {
    function reportIfColor(node, text) {
      COLOR_PATTERN.lastIndex = 0;
      const match = COLOR_PATTERN.exec(text);
      if (!match) return;
      context.report({
        node,
        messageId: 'hardcodedColor',
        data: { color: match[0] },
      });
    }

    return {
      Literal(node) {
        if (typeof node.value === 'string') reportIfColor(node, node.value);
      },
      TemplateElement(node) {
        reportIfColor(node, node.value.raw);
      },
    };
  },
};
