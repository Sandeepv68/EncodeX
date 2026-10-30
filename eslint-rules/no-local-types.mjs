/**
 * @fileoverview Custom ESLint rule that keeps type declarations in type files.
 *
 * Every `interface` and `type` alias belongs in a *type file* — a file whose
 * name marks it as one:
 *
 *   - `types.ts`      (the directory's shared types, e.g. `src/shared/types.ts`)
 *   - `*.types.ts`    (a module's own types, e.g. `foo.types.ts`)
 *   - `*.d.ts`        (ambient declaration files)
 *
 * Implementation files (components, pages, stores, services) describe *what
 * they do*; the shapes they speak are declared next to their peers. Keeping the
 * shapes in one place means a reader can see the whole contract of a layer
 * without scrolling through behaviour, and it stops a component file from
 * growing a private vocabulary that only its neighbours know about.
 *
 * Test files are excluded via the ESLint config override.
 */

import path from 'node:path';

/**
 * True when the file is a type file, i.e. a file whose whole purpose is to
 * declare types.
 * @param {string} filename - Absolute path of the linted file.
 * @returns {boolean} Whether the file is a type file.
 */
function isTypeFile(filename) {
  const base = path.basename(filename);
  return base === 'types.ts' || base.endsWith('.types.ts') || base.endsWith('.d.ts');
}

export default {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Disallow type declarations outside type files.',
    },
    messages: {
      localType: '{{kind}} declaration found. Move type declarations into a type file (types.ts / *.types.ts) next to their module.',
    },
    schema: [],
  },
  create(context) {
    const filename = context.filename ?? '';
    if (isTypeFile(filename)) return {};

    return {
      TSInterfaceDeclaration(node) {
        context.report({ node, messageId: 'localType', data: { kind: 'Interface' } });
      },
      TSTypeAliasDeclaration(node) {
        context.report({ node, messageId: 'localType', data: { kind: 'Type' } });
      },
    };
  },
};
