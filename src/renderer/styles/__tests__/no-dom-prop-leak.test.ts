/**
 * @fileoverview Guards against styled-component props leaking into the DOM.
 *
 * Every transient style prop in this codebase follows one convention: a
 * `$`-prefixed name plus an explicit `shouldForwardProp` that consumes it. The
 * prefix alone is not enough - MUI's `styled` only applies `isPropValid` when
 * the base is a host element, so `styled(Box)` / `styled(Chip)` forward every
 * prop they are given, `$` and all. The result is invalid attributes
 * (`$hidden="false"`, `hasaside=""`, `tone="video"`) in the shipped app plus a
 * React warning on every mount.
 *
 * Four such props shipped before this test existed. The check walks the real
 * AST rather than grepping text, because a `styled(...)` call's arguments are
 * nested parentheses - every regex tried to fake this failed silently, which is
 * worse than having no guard at all. It reads files as text and needs no theme,
 * no DOM and no bundler, and it fails in milliseconds.
 *
 * @see src/renderer/styles/*.styles.ts
 */

import { readdirSync, readFileSync, statSync } from 'fs';
import { join, relative } from 'path';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';

const STYLES_DIR = join(__dirname, '..');

/** Recursively collects every `.styles.ts` file under the styles directory. */
function collectStyleModules(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) return collectStyleModules(full);
    return entry.endsWith('.styles.ts') ? [full] : [];
  });
}

/**
 * One `styled()` call that declares `$`-prefixed props without a
 * `shouldForwardProp` to strip them.
 *
 * This type was referenced but never declared - the guard had never been
 * typechecked, which is precisely the gap `tsconfig.test.json` closes. It is
 * the reason the plan insists that every guard gets a compile as well as a
 * runtime check.
 * @interface Violation
 * @property {string[]} props - The transient prop names found on the call.
 * @property {number} line - 1-based source line of the `styled()` call.
 */
interface Violation {
  readonly props: string[];
  readonly line: number;
}

interface StyleModule {
  /** Path relative to the styles directory, for readable failure output. */
  readonly name: string;
  /** Every `$`-prefixed prop declared by a `styled()` call in this file. */
  readonly transientProps: string[];
  /** Transient props whose styled() call does not filter them out. */
  readonly violations: Violation[];
}

/**
 * The root identifier of a call's callee chain.
 *
 * `styled(Box)<{ $a: boolean }>(...)` does not parse as a call to `styled`; it
 * parses as a call whose *callee* is the call `styled(Box)`, with the type
 * arguments attached to the outer call. Matching on the outer call's
 * `expression` being the identifier `styled` therefore never fires, so the
 * chain has to be unwound to reach the name at its root.
 */
function calleeRoot(expression: ts.Expression): string | null {
  let node: ts.Expression = expression;
  while (ts.isCallExpression(node) || ts.isPropertyAccessExpression(node)) {
    node = ts.isPropertyAccessExpression(node) ? node.expression : node.expression;
  }
  return ts.isIdentifier(node) ? node.text : null;
}

/** The `$`-prefixed names in a `styled(...)<{...}>()` type argument list. */
function transientPropsOf(call: ts.CallExpression): string[] {
  const typeArgs = call.typeArguments;
  if (!typeArgs || typeArgs.length === 0) return [];

  const literal = typeArgs[0];
  if (!ts.isTypeLiteralNode(literal)) return [];

  return literal.members
    .filter(ts.isPropertySignature)
    .map((member) => member.name.getText().replace(/^['"`]|['"`]$/g, ''))
    .filter((name) => name.startsWith('$'));
}

/** Whether the styled() call passes a `shouldForwardProp` in its options arg. */
function hasShouldForwardProp(call: ts.CallExpression): boolean {
  // The options object belongs to the inner `styled(Base, { ... })` call, not
  // to the outer call that carries the style callback and the type arguments.
  const options = ts.isCallExpression(call.expression) ? call.expression.arguments[1] : undefined;
  if (!options || !ts.isObjectLiteralExpression(options)) return false;
  return options.properties.some(
    (prop) =>
      (ts.isPropertyAssignment(prop) || ts.isShorthandPropertyAssignment(prop)) &&
      prop.name.getText().replace(/^['"`]|['"`]$/g, '') === 'shouldForwardProp',
  );
}

function inspect(file: string): StyleModule {
  const source = ts.createSourceFile(file, readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true);

  const transientProps: string[] = [];
  const violations: Violation[] = [];

  const visit = (node: ts.Node): void => {
    if (ts.isCallExpression(node) && node.typeArguments?.length && calleeRoot(node.expression) === 'styled') {
      const props = transientPropsOf(node);
      if (props.length > 0) {
        transientProps.push(...props);
        if (!hasShouldForwardProp(node)) {
          const { line } = source.getLineAndCharacterOfPosition(node.getStart(source));
          violations.push({ props, line: line + 1 });
        }
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(source);

  return { name: relative(STYLES_DIR, file), transientProps, violations };
}

const STYLE_MODULES = collectStyleModules(STYLES_DIR).map(inspect);
const TOTAL_TRANSIENT_PROPS = STYLE_MODULES.reduce((sum, module) => sum + module.transientProps.length, 0);

describe('styled transient props', () => {
  it('actually inspects the style modules it guards', () => {
    // Guards the guard. A wrong AST walk matches nothing and would make every
    // assertion below pass for the wrong reason, so pin the shape of the data
    // the real assertions operate on.
    expect(STYLE_MODULES.length).toBeGreaterThan(20);
    expect(TOTAL_TRANSIENT_PROPS).toBeGreaterThan(20);
    expect(STYLE_MODULES.filter((module) => module.transientProps.length > 0).length).toBeGreaterThan(10);
  });

  it('leaks no transient props into the DOM', () => {
    const summary = STYLE_MODULES.flatMap((module) => module.violations.map((v) => `${module.name}:${v.line} -> ${v.props.join(', ')}`));

    expect(summary, 'styled() props on a non-host base must be filtered with shouldForwardProp').toEqual([]);
  });
});
