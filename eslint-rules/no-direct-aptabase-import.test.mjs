/**
 * @fileoverview Unit tests for the `no-direct-aptabase-import` custom ESLint
 * rule using ESLint's RuleTester. Run with `npm run lint:aptabase:test`.
 */

import tsParser from '@typescript-eslint/parser';
import { RuleTester } from 'eslint';
import noDirectAptabaseImport from './no-direct-aptabase-import.mjs';

const ruleTester = new RuleTester({
  languageOptions: {
    parser: tsParser,
    ecmaVersion: 'latest',
    sourceType: 'module',
    parserOptions: {
      ecmaFeatures: { jsx: true },
    },
  },
});

const adapterMain = 'src/main/analytics/aptabaseMainProvider.ts';
const adapterRenderer = 'src/renderer/analytics/aptabaseRendererProvider.ts';
const arbitraryFile = 'src/renderer/pages/Settings.tsx';
const sharedFile = 'src/shared/analytics/AnalyticsService.ts';

ruleTester.run('no-direct-aptabase-import', noDirectAptabaseImport, {
  valid: [
    // Adapters may import the SDK (static and dynamic forms).
    {
      code: "import { initialize } from '@aptabase/electron/main';",
      filename: adapterMain,
    },
    {
      code: "const mod = await import('@aptabase/electron/renderer');",
      filename: adapterRenderer,
    },
    {
      code: "import('@aptabase/electron/main');",
      filename: adapterMain,
    },
    // Non-adapter files may import anything else.
    {
      code: "import { Logger } from '../../shared/logger';",
      filename: arbitraryFile,
    },
    {
      code: "import type { AnalyticsProvider } from './types';",
      filename: sharedFile,
    },
    {
      code: "import { createAnalyticsEvent } from './events';",
      filename: sharedFile,
    },
  ],
  invalid: [
    {
      code: "import { initialize } from '@aptabase/electron/main';",
      filename: arbitraryFile,
      errors: [{ messageId: 'directImport' }],
    },
    {
      code: "const mod = await import('@aptabase/electron/renderer');",
      filename: sharedFile,
      errors: [{ messageId: 'directImport' }],
    },
    {
      code: "import('@aptabase/electron/main');",
      filename: arbitraryFile,
      errors: [{ messageId: 'directImport' }],
    },
  ],
});