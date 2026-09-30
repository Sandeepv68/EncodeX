/**
 * @fileoverview Minimal setup file for the Node-environment suites.
 *
 * The integration suite runs with `environment: 'node'` and needs none of the
 * jsdom/test doubles from `src/test-setup.ts`, but it does need the same crash
 * tripwire: an unhandled rejection inside an integration test means a real
 * rejection in the code under test, and must fail the run rather than scroll
 * past in the log.
 *
 * @see src/test-utils/crash-tripwire.ts
 */

import { registerCrashAssertions } from './test-utils/crash-tripwire';

registerCrashAssertions();
