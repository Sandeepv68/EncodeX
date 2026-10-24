import { styled } from '@mui/material/styles';
import { Box } from '@mui/material';

/**
 * Typographic container for assistant message content. Applies consistent
 * spacing and hierarchy to semantic headings, paragraphs and lists while
 * leaving MUI's icon-led List layout untouched.
 */
export const AssistantBody = styled(Box)(({ theme }) => ({
  width: '100%',
  '& h1, & h2, & h3, & h4, & h5, & h6': {
    margin: 0,
    marginTop: theme.spacing(2),
    marginBottom: theme.spacing(1),
    fontWeight: theme.typography.fontWeightBold,
    lineHeight: theme.typography.h6.lineHeight,
    '&:first-of-type': { marginTop: 0 },
  },
  '& p': {
    margin: 0,
    marginBottom: theme.spacing(1),
    lineHeight: theme.typography.body1.lineHeight,
    '&:last-child': { marginBottom: 0 },
  },
  '& ul:not(.MuiList-root), & ol:not(.MuiList-root)': {
    margin: 0,
    marginBottom: theme.spacing(1),
    paddingInlineStart: theme.spacing(3),
  },
  '& ul:not(.MuiList-root) > li, & ol:not(.MuiList-root) > li': {
    marginBottom: theme.spacing(0.5),
    '&:last-child': { marginBottom: 0 },
  },
}));
