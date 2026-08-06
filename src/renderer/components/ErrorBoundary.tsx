/**
 * @fileoverview React error boundary for the renderer.
 *
 * Catches JavaScript errors thrown by child component trees during rendering,
 * lifecycle methods, or constructors, preventing the whole app from crashing.
 * On error it either renders a caller-supplied `fallback` node or a default
 * localized fallback panel (warning icon, title, the error message or a generic
 * description, and a "Try Again" button that resets the boundary).
 *
 * The caught error is logged through the shared Logger using the
 * LOG_ERROR_BOUNDARY_CAUGHT constant, including the message and React's
 * component stack. Reset is performed via `getDerivedStateFromError` storing
 * the error in state, and the "Try Again" button clearing that state to
 * re-render the children.
 *
 * Note: error boundaries do not catch errors in event handlers, async code, or
 * errors thrown in the boundary itself.
 *
 * Props/state types: {@link ErrorBoundaryProps}, {@link ErrorBoundaryState}.
 */

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

/**
 * Class component that acts as an error boundary.
 *
 * Wraps arbitrary children and swaps in a fallback UI whenever a descendant
 * throws during render. The boundary state distinguishes "no error" from
 * "error caught" so the children are only hidden while the boundary is armed.
 * @class ErrorBoundary
 * @extends {Component<ErrorBoundaryProps, ErrorBoundaryState>}
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  /**
   * Creates the boundary with an initial error-free state.
   * @param {ErrorBoundaryProps} props - The wrapped subtree and optional
   *   custom fallback.
   */
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  /**
   * Static lifecycle hook invoked when a descendant throws. Arms the boundary
   * and stores the offending error so it can be rendered by the fallback UI.
   * @param {Error} error - The error thrown by the child tree.
   * @returns {ErrorBoundaryState} The next state marking the boundary as armed.
   */
  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  /**
   * Lifecycle hook invoked after the boundary catches an error. Logs the
   * failure (message plus React component stack) through the shared logger.
   * @param {Error} error - The error that was caught.
   * @param {ErrorInfo} errorInfo - Object carrying the component stack trace.
   * @returns {void}
   */
  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    log.error(LOG_ERROR_BOUNDARY_CAUGHT, error.message, errorInfo.componentStack);
  }

  /**
   * Renders the fallback UI when armed, otherwise the wrapped children.
   *
   * When armed, a custom `fallback` prop takes precedence; otherwise a default
   * localized panel is shown whose "Try Again" button resets `hasError` to
   * false and clears the stored error, re-rendering the children. Text comes
   * from the i18n `errorBoundary.*` keys.
   * @returns {ReactNode} The fallback node or the children.
   */
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
