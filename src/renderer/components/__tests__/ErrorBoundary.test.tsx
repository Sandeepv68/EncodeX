import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ErrorBoundary } from '../ErrorBoundary';

let throwError = true;
function ConditionalBadChild() {
  if (throwError) throw new Error('crash');
  return <div>recovered</div>;
}

const GoodChild = () => <div>working component</div>;
const BadChild = () => {
  throw new Error('crash');
};

describe('ErrorBoundary', () => {
  beforeEach(() => {
    throwError = true;
  });

  it('renders children when there is no error', () => {
    render(
      <ErrorBoundary>
        <GoodChild />
      </ErrorBoundary>,
    );
    expect(screen.getByText('working component')).toBeInTheDocument();
  });

  it('renders fallback UI on error', () => {
    render(
      <ErrorBoundary>
        <BadChild />
      </ErrorBoundary>,
    );
    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
    expect(screen.getByText('crash')).toBeInTheDocument();
  });

  it('renders custom fallback when provided', () => {
    render(
      <ErrorBoundary fallback={<div>custom fallback</div>}>
        <BadChild />
      </ErrorBoundary>,
    );
    expect(screen.getByText('custom fallback')).toBeInTheDocument();
  });

  it('resets error state when Try Again is clicked', () => {
    const { rerender } = render(
      <ErrorBoundary>
        <ConditionalBadChild />
      </ErrorBoundary>,
    );
    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
    throwError = false;
    fireEvent.click(screen.getByText('Try Again'));
    expect(screen.getByText('recovered')).toBeInTheDocument();
  });
});
