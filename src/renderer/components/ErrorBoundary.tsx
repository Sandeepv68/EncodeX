import { Component, ReactNode, ErrorInfo } from 'react';
import { Button } from '@mui/material';
import { faTriangleExclamation, faRotateRight } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { Logger } from '../../shared/logger';
import i18n from '../i18n/config';
import type { ErrorBoundaryProps, ErrorBoundaryState } from './types';
import { FallbackBox, FallbackPaper, WarningIcon, FallbackTitle, FallbackDescription } from '../styles/ErrorBoundary.styles';
import { LOG_ERROR_BOUNDARY_CAUGHT } from '../../shared/log-constants';

const log = new Logger('renderer/components/ErrorBoundary');

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    log.error(LOG_ERROR_BOUNDARY_CAUGHT, error.message, errorInfo.componentStack);
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
