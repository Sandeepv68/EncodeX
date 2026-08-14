/**
 * @fileoverview Standard page layout wrapper.
 *
 * Provides the shared scaffold for top-level pages: a page title (optionally
 * prefixed with an icon), a body that wraps `children` in a styled paper card by
 * default, and an optional aside column rendered to the right of the body.
 *
 * When an `aside` is supplied the root is flagged so the styles can switch to a
 * two-column layout. All pages under `src/renderer/pages` compose this
 * component to keep headers, spacing, and card styling consistent.
 *
 * Props (see {@link PageContainerProps}):
 *  - title: heading text for the page.
 *  - icon: optional ReactNode rendered before the title.
 *  - aside: optional ReactNode rendered in the side column.
 *  - paper: when true (default), wraps children in a ContentPaper card.
 *  - children: the page body content.
 */

import type { PageContainerProps } from './types';
import { PageRoot, PageBody, PageTitle, TitleIcon, ContentPaper } from '../styles/PageContainer.styles';

/**
 * Renders the standard page layout container.
 *
 * Renders a PageRoot (styled with an aside-aware flag when `aside` is present)
 * containing a PageBody with a PageTitle heading — prefixed by the optional
 * `icon` inside a TitleIcon — followed by the content. Content is wrapped in a
 * ContentPaper card when `paper` is true, otherwise rendered bare. The optional
 * `aside` node is placed after the body as a side column.
 *
 * @param {PageContainerProps} props - Component props.
 * @param {string} props.title - The page heading text.
 * @param {React.ReactNode} [props.icon] - Optional icon rendered before the
 *   title.
 * @param {React.ReactNode} [props.aside] - Optional node rendered in the side
 *   column.
 * @param {boolean} [props.paper] - When true (default), wraps children in a
 *   ContentPaper card.
 * @param {React.ReactNode} props.children - The page body content.
 * @returns {JSX.Element} The page scaffold.
 */
export default function PageContainer({ title, icon, aside, paper = true, children }: PageContainerProps) {
  return (
    <PageRoot hasAside={!!aside}>
      <PageBody>
        <PageTitle variant="h5" component="h1">
          {icon && <TitleIcon>{icon}</TitleIcon>}
          {title}
        </PageTitle>
        {paper ? <ContentPaper>{children}</ContentPaper> : children}
      </PageBody>
      {aside}
    </PageRoot>
  );
}
