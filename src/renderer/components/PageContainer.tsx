import type { PageContainerProps } from './types';
import { PageRoot, PageBody, PageTitle, TitleIcon, ContentPaper } from '../styles/PageContainer.styles';

export default function PageContainer({ title, icon, aside, paper = true, children }: PageContainerProps) {
  return (
    <PageRoot hasAside={!!aside}>
      <PageBody>
        <PageTitle variant="h5">
          {icon && <TitleIcon>{icon}</TitleIcon>}
          {title}
        </PageTitle>
        {paper ? <ContentPaper>{children}</ContentPaper> : children}
      </PageBody>
      {aside}
    </PageRoot>
  );
}
