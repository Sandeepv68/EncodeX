import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import PageContainer from '../PageContainer';
import { useErrorStore } from '../../stores/errorStore';
import { ErrorCode } from '../../../shared/errors';

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

  it('renders children without the wrapping paper when paper is false', () => {
    const { container } = render(
      <PageContainer title="Dashboard" paper={false}>
        <p>bare content</p>
      </PageContainer>,
    );
    const body = container.querySelector('.MuiPaper-root');
    expect(screen.getByText('bare content')).toBeInTheDocument();
    expect(body).toBeNull();
  });

  it('does not render error UI when there is a current error', () => {
    useErrorStore.getState().showErrorMessage(ErrorCode.CONVERSION_FAILED, 'boom');
    render(
      <PageContainer title="Convert">
        <p>content</p>
      </PageContainer>,
    );
    expect(screen.queryByText(/The conversion process failed/)).not.toBeInTheDocument();
    expect(screen.queryByText('boom')).not.toBeInTheDocument();
  });
});
