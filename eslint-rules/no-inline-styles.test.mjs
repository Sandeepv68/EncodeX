/**
 * @fileoverview Unit tests for the `no-inline-styles` custom ESLint rule using
 * ESLint's RuleTester. Run with `npm run lint:inline-styles:test`.
 */

import tsParser from '@typescript-eslint/parser';
import { RuleTester } from 'eslint';
import noInlineStyles from './no-inline-styles.mjs';

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

ruleTester.run('no-inline-styles', noInlineStyles, {
  valid: [
    // Styled components live in stylesheets and may hold any amount of CSS.
    'const S = styled("div")({ color: "red" });',
    // A reference to a style object defined in a stylesheet is fine.
    'import { boxSx } from "./styles"; const A = () => <Box sx={boxSx} />;',
    // sx that is not a literal/function is not a call-site style definition.
    'const A = () => <Box sx={sxProp} />;',
    // Plain attributes are unaffected.
    'const A = () => <div className="x" id="y" />;',
  ],
  invalid: [
    {
      code: 'const A = () => <div style={{ color: "red" }} />;',
      errors: [{ messageId: 'inlineStyle' }],
    },
    {
      code: 'const A = () => <div style="color: red" />;',
      errors: [{ messageId: 'inlineStyle' }],
    },
    {
      code: 'const A = () => <Box sx={{ marginTop: 1 }} />;',
      errors: [{ messageId: 'inlineSx' }],
    },
    {
      code: 'const A = () => <Box sx={(theme) => ({ marginTop: theme.spacing(1) })} />;',
      errors: [{ messageId: 'inlineSx' }],
    },
    {
      code: 'const A = () => <Autocomplete slotProps={{ paper: { sx: { maxHeight: 360 } } }} />;',
      errors: [{ messageId: 'inlineSx' }],
    },
    {
      code: 'const box = { marginTop: 1 }; const A = () => <Box sx={box} />;',
      errors: [{ messageId: 'localStyleObject' }],
    },
    {
      code: 'const box = { marginTop: 1 }; const A = () => <div style={box} />;',
      errors: [{ messageId: 'localStyleObject' }],
    },
    {
      code: 'import { keyframes } from "@mui/material/styles"; const fade = keyframes`from { opacity: 0 }`;',
      errors: [{ messageId: 'inlineKeyframes' }],
      filename: 'src/renderer/components/Thing.tsx',
    },
    {
      code: 'const A = () => <Box sx={{ "@keyframes fade": { from: { opacity: 0 } } }} />;',
      errors: [{ messageId: 'inlineSx' }, { messageId: 'inlineKeyframes' }],
      filename: 'src/renderer/components/Thing.tsx',
    },
  ],
});
