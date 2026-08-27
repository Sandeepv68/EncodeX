/**
 * @fileoverview Custom ESLint rule that flags inline `style` props on JSX
 * elements in TSX files.
 *
 * All styling must go through MUI's `styled()` API or theme tokens so the
 * codebase stays consistent, themeable, and free of hardcoded values.
 * The rule catches both object styles (`style={{ ... }}`) and string
 * styles (`style="..."`).
 *
 * Test files are excluded via the ESLint config override.
 */

export default {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Disallow inline style props; use styled() components instead.',
    },
    messages: {
      inlineStyle: 'Inline style prop found. Use a styled() component from the styles directory instead.',
    },
    schema: [],
  },
  create(context) {
    return {
      JSXAttribute(node) {
        if (node.name.name !== 'style') return;

        // style={{ ... }}  —  JSXExpressionContainer wrapping an ObjectExpression
        if (
          node.value?.type === 'JSXExpressionContainer' &&
          node.value.expression.type === 'ObjectExpression'
        ) {
          context.report({ node, messageId: 'inlineStyle' });
          return;
        }

        // style="..."  —  string literal
        if (node.value?.type === 'Literal' && typeof node.value.value === 'string') {
          context.report({ node, messageId: 'inlineStyle' });
        }
      },
    };
  },
};
