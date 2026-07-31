import { Box, Typography, Paper } from '@mui/material';
import { useErrorStore } from '../stores/errorStore';
import ErrorBanner from './ErrorBanner';
import { ErrorBoundary } from './ErrorBoundary';

interface Props {
  title: string;
  children: React.ReactNode;
}

export default function PageContainer({ title, children }: Props) {
  const currentError = useErrorStore((s) => s.currentError);
  const clearError = useErrorStore((s) => s.clearError);
  return (
    <Box>
      <Typography variant="h5" sx={{ fontWeight: 600, mb: 2 }}>
        {title}
      </Typography>
      <Paper sx={{ p: { xs: 2, sm: 3 }, width: '100%', display: 'flex', flexDirection: 'column', gap: 2 }}>
        {currentError && (
          <ErrorBoundary fallback={null}>
            <ErrorBanner error={currentError} onClose={clearError} />
          </ErrorBoundary>
        )}
        {children}
      </Paper>
    </Box>
  );
}
