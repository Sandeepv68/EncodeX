import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import TermsDialog from '../TermsDialog';
import { useTermsStore } from '../../stores/termsStore';
import { TERMS_ACCEPTED_STORAGE_KEY } from '../../../shared/constants';
import { TERMS_VERSION, TERMS_SECTIONS } from '../../../shared/terms';

const STORAGE_KEY = TERMS_ACCEPTED_STORAGE_KEY;

describe('TermsDialog', () => {
  beforeEach(() => {
    localStorage.clear();
    useTermsStore.setState({ dialogOpen: false, mode: 'accept' });
    vi.clearAllMocks();
  });

  it('renders nothing when closed', () => {
    useTermsStore.setState({ dialogOpen: false, mode: 'accept' });
    const { container } = render(<TermsDialog />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders the terms sections with accept and reject actions in accept mode', () => {
    useTermsStore.setState({ dialogOpen: true, mode: 'accept' });
    render(<TermsDialog />);
    expect(screen.getByTestId('terms-dialog')).toBeInTheDocument();
    expect(screen.getByText(TERMS_SECTIONS[0].title)).toBeInTheDocument();
    expect(screen.getByText(TERMS_SECTIONS[0].body[0])).toBeInTheDocument();
    expect(screen.getByTestId('terms-accept')).toBeInTheDocument();
    expect(screen.getByTestId('terms-reject')).toBeInTheDocument();
    expect(screen.queryByTestId('terms-close')).not.toBeInTheDocument();
  });

  it('accepting persists the consent and closes the dialog', () => {
    useTermsStore.setState({ dialogOpen: true, mode: 'accept' });
    render(<TermsDialog />);
    fireEvent.click(screen.getByTestId('terms-accept'));
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null') as { version: string; acceptedAt: string };
    expect(stored.version).toBe(TERMS_VERSION);
    expect(useTermsStore.getState().dialogOpen).toBe(false);
  });

  it('rejecting requests the app to quit', () => {
    useTermsStore.setState({ dialogOpen: true, mode: 'accept' });
    render(<TermsDialog />);
    fireEvent.click(screen.getByTestId('terms-reject'));
    expect(window.electronAPI.rejectTerms).toHaveBeenCalled();
  });

  it('renders only a Close action in view mode', () => {
    useTermsStore.setState({ dialogOpen: true, mode: 'view' });
    render(<TermsDialog />);
    expect(screen.getByTestId('terms-close')).toBeInTheDocument();
    expect(screen.queryByTestId('terms-accept')).not.toBeInTheDocument();
    expect(screen.queryByTestId('terms-reject')).not.toBeInTheDocument();
  });

  it('Close in view mode dismisses the dialog without persisting consent', () => {
    useTermsStore.setState({ dialogOpen: true, mode: 'view' });
    render(<TermsDialog />);
    fireEvent.click(screen.getByTestId('terms-close'));
    expect(useTermsStore.getState().dialogOpen).toBe(false);
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
  });
});
