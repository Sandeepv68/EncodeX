import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import PageContainer from '../PageContainer';
import { useErrorStore } from '../../stores/errorStore';
import { createError, ErrorCode } from '../../../shared/errors';

describe('PageContainer', () => {
  beforeEach(() => {
    useErrorStore.setState({ currentError: null, errorHistory: [] });
  });

  it('renders title and children', () => {
    render(
      <PageContainer title="Dashboard">
        <p>hello content</p>
      </PageContainer>,
    );
    expect(screen.getByText('Dashboard')).toBeInTheDocument();
    expect(screen.getByText('hello content')).toBeInTheDocument();
  });

  it('renders an error banner when there is a current error', () => {
    useErrorStore.getState().showErrorMessage(ErrorCode.CONVERSION_FAILED, 'boom');
    render(
      <PageContainer title="Convert">
        <p>content</p>
      </PageContainer>,
    );
    expect(screen.getByText(/The conversion process failed/)).toBeInTheDocument();
    expect(screen.getByText('boom')).toBeInTheDocument();
  });

  it('clears the error when the banner close button is clicked', () => {
    useErrorStore.getState().showErrorMessage(ErrorCode.UNKNOWN, 'detail');
    render(
      <PageContainer title="Logs">
        <p>content</p>
      </PageContainer>,
    );
    fireEvent.click(screen.getByRole('button'));
    expect(useErrorStore.getState().currentError).toBeNull();
    expect(screen.queryByText(/An unexpected error occurred/)).not.toBeInTheDocument();
  });

  it('does not render a banner without a current error', () => {
    render(
      <PageContainer title="Logs">
        <p>content</p>
      </PageContainer>,
    );
    expect(useErrorStore.getState().currentError).toBeNull();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });
});
