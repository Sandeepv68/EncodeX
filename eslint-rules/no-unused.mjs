/**
 * @fileoverview Custom ESLint rule that flags unused variables, imports,
 * functions, and classes.
 *
 * Detects dead code by walking the scope tree and reporting any declared
 * binding that is never referenced:
 *
 *   - `const`/`let`/`var` variables (including destructured bindings)
 *   - ES module imports (default, named, and namespace)
 *   - function declarations
 *   - class declarations
 *
 * Exemptions (mirror ESLint core `no-unused-vars` behaviour):
 *   - Bindings that are `export default`ed (the export consumes them).
 *   - Bindings that are assigned to later (a write counts as a usage).
 *   - Function parameters are intentionally NOT reported — the requested
 *     scope is variables, imports, functions, and classes.
 *
 * Type-only declarations (interfaces, type aliases, etc.) are skipped because
 * they resolve to scope variables of other definition types; `import type`
 * bindings are reported as unused imports only when they are also unused as
 * type references.
 */

/** Maps an eslint-scope definition type to the user-facing kind label. */
const KIND_BY_DEF_TYPE = {
  ImportBinding: 'import',
  Variable: 'variable',
  FunctionName: 'function',
  ClassName: 'class',
};

/**
 * True when a def is the class's own self-referencing name binding. The parser
 * creates an extra `ClassName` variable inside the class's scope that has no
 * references of its own; the real declaration lives in the enclosing scope, so
 * this inner duplicate must not be reported as unused.
 */
function isClassSelfBinding(def, variable) {
  return def.type === 'ClassName' && variable.scope?.type === 'class' && variable.scope?.block === def.node;
}

/** True when the definition is consumed by an `export` declaration. */
function isExported(def) {
  // Function and class name defs store the declaration in `def.node`.
  const declaration =
    def.node?.type === 'FunctionDeclaration' || def.node?.type === 'ClassDeclaration' ? def.node : null;
  if (declaration && (declaration.parent?.type === 'ExportDefaultDeclaration' || declaration.parent?.type === 'ExportNamedDeclaration')) return true;
  // `export const/let/var v = ...`: the variable def parent is the VariableDeclaration.
  return def.parent?.type === 'VariableDeclaration' && def.parent.parent?.type === 'ExportNamedDeclaration';
}

export default {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Disallow unused variables, imports, functions, and classes.',
    },
    messages: {
      unused: "Unused {{kind}} '{{name}}'. Remove it or use it.",
    },
    schema: [],
  },
  create(context) {
    return {
      Program(node) {
        const scope = context.sourceCode.getScope(node);

        const walk = (current) => {
          for (const variable of current.variables) {
            // A read reference (or an `export { v }` specifier) makes the
            // binding "used". Declaration-site write references are ignored so
            // that write-only variables are still reported as dead code.
            const hasRead = variable.references.some((ref) => ref.isRead() || ref.identifier?.parent?.type === 'ExportSpecifier');
            if (hasRead) continue;
            for (const def of variable.defs) {
              const kind = KIND_BY_DEF_TYPE[def.type];
              if (!kind || isExported(def) || isClassSelfBinding(def, variable)) continue;
              // Names of function/class EXPRESSIONS (e.g. `forwardRef(function
              // X() {...})` for a DevTools-friendly display name) are inert;
              // only declaration statements represent dead code.
              if (def.node?.type === 'FunctionExpression' || def.node?.type === 'ClassExpression') continue;
              const identifier = def.name;
              if (!identifier || identifier.type !== 'Identifier') continue;
              context.report({
                node: identifier,
                messageId: 'unused',
                data: { kind, name: identifier.name },
              });
            }
          }
          for (const child of current.childScopes) {
            walk(child);
          }
        };

        walk(scope);
      },
    };
  },
};