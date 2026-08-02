import { Component, ReactNode, ErrorInfo } from 'react';
import { Button } from '@mui/material';
import { faTriangleExclamation, faRotateRight } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { Logger } from '../../shared/logger';
import i18n from '../i18n/config';
import { FallbackBox, FallbackPaper, WarningIcon, FallbackTitle, FallbackDescription } from '../styles/ErrorBoundary.styles';

const log = new Logger('renderer/components/ErrorBoundary');

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    log.error('ErrorBoundary caught:', error.message, errorInfo.componentStack);
  }

  render(): ReactNode {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;
      const t = i18n.t.bind(i18n);
      return (
        <FallbackBox>
          <FallbackPaper>
            <WarningIcon icon={faTriangleExclamation} />
            <FallbackTitle variant="h6">{t('errorBoundary.title')}</FallbackTitle>
            <FallbackDescription variant="body2" color="text.secondary">
              {this.state.error?.message || t('errorBoundary.description')}
            </FallbackDescription>
            <Button
              variant="contained"
              startIcon={<FontAwesomeIcon icon={faRotateRight} />}
              onClick={() => this.setState({ hasError: false, error: null })}
            >
              {t('errorBoundary.tryAgain')}
            </Button>
          </FallbackPaper>
        </FallbackBox>
      );
    }
    return this.props.children;
  }
}
