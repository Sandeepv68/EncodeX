/**
 * @fileoverview Custom ESLint rule that flags inline styling in TSX files.
 *
 * All styling must go through MUI's `styled()` API (or theme tokens) so the
 * codebase stays consistent, themeable, and free of hardcoded values. The rule
 * catches:
 *
 *  - object styles (`style={{ ... }}`) and string styles (`style="..."`)
 *  - `sx` props written inline (object literals, theme callbacks), including
 *    the nested `slotProps={{ paper: { sx: { ... } } }}` form
 *  - style objects declared as local constants and then applied through a prop
 *  - keyframes / animation definitions (`keyframes` tags, `@keyframes` blocks)
 *
 * Test files are excluded via the ESLint config override. Stylesheets
 * (`*.styles.ts`) are the destination for these rules, so they are exempt from
 * the `sx` and keyframes checks.
 */

/** Props whose value is a style declaration. */
const STYLE_PROPS = new Set(['style', 'sx']);

/**
 * True when the expression is a style definition written at the call site
 * rather than a reference to one defined elsewhere.
 * @param {object} node - Expression node.
 * @returns {boolean} Whether the expression is an inline style definition.
 */
function isInlineStyleExpression(node) {
  if (!node) return false;
  return node.type === 'ObjectExpression' || node.type === 'ArrowFunctionExpression' || node.type === 'FunctionExpression';
}

/**
 * True when the key of an object property is the given name, whether it is
 * written as a plain identifier or as a string literal.
 * @param {object} node - Property node.
 * @param {string} name - Expected key name.
 * @returns {boolean} Whether the property carries that key.
 */
function hasKey(node, name) {
  if (!node.key) return false;
  if (node.key.type === 'Identifier') return node.key.name === name;
  if (node.key.type === 'Literal') return node.key.value === name;
  return false;
}

/**
 * The literal text of a property key, whether it is an identifier or a string.
 * @param {object} node - Property node.
 * @returns {string} The key text, or an empty string.
 */
function keyText(node) {
  if (!node.key) return '';
  if (node.key.type === 'Identifier') return node.key.name;
  if (node.key.type === 'Literal' && typeof node.key.value === 'string') return node.key.value;
  return '';
}

export default {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Disallow inline style props; use styled() components instead.',
    },
    messages: {
      inlineStyle: 'Inline style prop found. Use a styled() component from the styles directory instead.',
      inlineSx: 'Inline sx prop found. Move the style object into a styled() component in the styles directory.',
      localStyleObject: 'Inline style object found. Move the style object into a styled() component in the styles directory.',
      inlineKeyframes: 'Keyframes and animation definitions belong in a stylesheet, not in a component file.',
    },
    schema: [],
  },
  create(context) {
    const filename = context.filename ?? '';
    const isTsx = filename.endsWith('.tsx');
    // Stylesheets are where styles live; they are exempt from the checks that
    // push styling out of component files.
    const isStyleSheet = /\.styles\.ts$/.test(filename);

    /** Names of local constants that hold a style object. @type {Set<string>} */
    const localStyleObjects = new Set();

    /**
     * Reports a style definition found at the call site.
     * @param {object} node - Node to report.
     * @param {string} messageId - Message to report.
     * @returns {void}
     */
    const report = (node, messageId) => {
      context.report({ node, messageId });
    };

    return {
      // Local style objects (`const s = { ... }`) are style definitions that
      // belong in a stylesheet, even when they are applied through a prop.
      VariableDeclarator(node) {
        if (!node.id || node.id.type !== 'Identifier') return;
        if (!isInlineStyleExpression(node.init)) return;
        if (node.init.type !== 'ObjectExpression') return;
        localStyleObjects.add(node.id.name);
      },

      JSXAttribute(node) {
        const name = node.name?.name;
        if (typeof name !== 'string') return;

        // style={{ ... }}  —  JSXExpressionContainer wrapping an ObjectExpression
        if (name === 'style') {
          if (node.value?.type === 'JSXExpressionContainer' && node.value.expression.type === 'ObjectExpression') {
            report(node, 'inlineStyle');
            return;
          }

          // style="..."  —  string literal
          if (node.value?.type === 'Literal' && typeof node.value.value === 'string') {
            report(node, 'inlineStyle');
            return;
          }

          // style={localStyleObject}  —  a style object declared in this file
          if (node.value?.type === 'JSXExpressionContainer' && node.value.expression.type === 'Identifier') {
            if (localStyleObjects.has(node.value.expression.name)) {
              report(node, 'localStyleObject');
            }
          }
          return;
        }

        // sx={{ ... }} / sx={(theme) => ({ ... })}  —  inline style definitions
        if (name === 'sx' && !isStyleSheet) {
          if (node.value?.type !== 'JSXExpressionContainer') return;
          const expression = node.value.expression;
          if (isInlineStyleExpression(expression)) {
            report(node, 'inlineSx');
            return;
          }
          if (expression.type === 'Identifier' && localStyleObjects.has(expression.name)) {
            report(node, 'localStyleObject');
          }
        }
      },

      // Nested `sx` in slot props: slotProps={{ paper: { sx: { ... } } }}
      Property(node) {
        if (isStyleSheet) return;
        // A raw `@keyframes` block is a keyframe definition.
        if (keyText(node).startsWith('@keyframes')) {
          report(node, 'inlineKeyframes');
          return;
        }
        if (!hasKey(node, 'sx')) return;
        if (!isInlineStyleExpression(node.value)) return;
        report(node, 'inlineSx');
      },

      // Keyframes belong in a stylesheet: `keyframes`...`` and `@keyframes` blocks
      TaggedTemplateExpression(node) {
        if (!isTsx || isStyleSheet) return;
        const tag = node.tag;
        const tagName = tag?.type === 'Identifier' ? tag.name : tag?.property?.name;
        if (tagName !== 'keyframes') return;
        report(node, 'inlineKeyframes');
      },

      TemplateLiteral(node) {
        if (!isTsx || isStyleSheet) return;
        const raw = node.quasis.map((quasi) => quasi.value.raw).join('');
        if (!raw.includes('@keyframes')) return;
        report(node, 'inlineKeyframes');
      },
    };
  },
};
