/**
 * Stryker mutation-testing configuration (Phase 9).
 *
 * Mutates the logic that decides what ffmpeg runs and what is stored:
 *   - shared validation / math / progress / ffmpeg helpers,
 *   - the transcoders that build argv (`ffmpeg-utils`, `ffprobe-mapper`),
 *   - the queue scheduler + transfer logic,
 *   - the renderer stores and utils.
 *
 * Only the five listed mutators are used; arithmetic/conditional/return/block
 * mutations are the ones with a real chance of surviving while still running
 * the app, so they are the only ones the gate is measured against.
 *
 * The score gate is a CI *delta* (scripts/mutation-delta.mjs), so `break` is
 * null here: running `npm run test:mutate` should never fail the floor
 * directly, it just measures. Threshold labels (high 80 / low 70) express the
 * plan's eventual target without making local runs exit non-zero.
 *
 * Type checking is disabled per mutant: the repo's own `typecheck` gate owns
 * type safety, and Stryker's per-mutant type check would otherwise re-check
 * the whole project (with JSX/tsconfig quirks) for every mutant.
 */
export default {
  testRunner: 'vitest',
  vitest: {
    configFile: 'vitest.mutation.config.ts',
  },
  mutate: [
    'src/shared/{errors,validation,math,progress,estimate,codec-containers,video-filters,remux-utils}.ts',
    'src/main/transcoders/{ffmpeg-utils,ffprobe-mapper}.ts',
    'src/main/queue/{job-queue,queue-transfer}.ts',
    'src/renderer/stores/*.ts',
    'src/renderer/utils/*.ts',
  ],
  // Stryker v10 selects mutators by exclusion. The plan's five families
  // ("ConditionalExpression", "LogicalExpression", "ArithmeticOperator",
  // "ReturnValue", "BlockStatement") map onto the babel-era names:
  // ConditionalExpression, LogicalOperator, ArithmeticOperator, BlockStatement,
  // and ArrowFunction (the closest living family to the removed ReturnValue,
  // which changed what a call returns). Everything else is excluded so the
  // score is measured only on the mutations with a real chance of surviving
  // while the app still runs.
  mutator: {
    excludedMutations: [
      'ArrayDeclaration',
      'AssignmentOperator',
      'BooleanLiteral',
      'CallExpression',
      'EqualityOperator',
      'MethodExpression',
      'ObjectLiteral',
      'OptionalChaining',
      'Regex',
      'StringLiteral',
      'UnaryOperator',
      'UpdateOperator',
    ],
  },
  thresholds: {
    high: 80,
    low: 70,
    break: null,
  },
  timeoutMS: 30000,
  timeoutFactor: 1.5,
  reporters: ['progress', 'html', 'json'],
  concurrency: 2,
  incremental: true,
  incrementalFile: '.stryker/incremental.json',
  disableTypeChecks: true,
  tempDirName: '.stryker-tmp',
};
