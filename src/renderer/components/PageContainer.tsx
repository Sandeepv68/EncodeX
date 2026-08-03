import { PageRoot, PageBody, PageTitle, TitleIcon, ContentPaper } from '../styles/PageContainer.styles';

interface Props {
  title: string;
  icon?: React.ReactNode;
  aside?: React.ReactNode;
  children: React.ReactNode;
}

export default function PageContainer({ title, icon, aside, children }: Props) {
  return (
    <PageRoot hasAside={!!aside}>
      <PageBody>
        <PageTitle variant="h5">
          {icon && <TitleIcon>{icon}</TitleIcon>}
          {title}
        </PageTitle>
        <ContentPaper>{children}</ContentPaper>
      </PageBody>
      {aside}
    </PageRoot>
  );
}
