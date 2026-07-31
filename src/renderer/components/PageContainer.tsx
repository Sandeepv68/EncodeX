import { Box } from '@mui/material';
import { useErrorStore } from '../stores/errorStore';
import ErrorBanner from './ErrorBanner';
import { ErrorBoundary } from './ErrorBoundary';
import { PageTitle, ContentPaper } from '../styles/PageContainer.styles';

interface Props {
  title: string;
  children: React.ReactNode;
}

export default function PageContainer({ title, children }: Props) {
  const currentError = useErrorStore((s) => s.currentError);
  const clearError = useErrorStore((s) => s.clearError);
  return (
    <Box>
      <PageTitle variant="h5">{title}</PageTitle>
      <ContentPaper>
        {currentError && (
          <ErrorBoundary fallback={null}>
            <ErrorBanner error={currentError} onClose={clearError} />
          </ErrorBoundary>
        )}
        {children}
      </ContentPaper>
    </Box>
  );
}
