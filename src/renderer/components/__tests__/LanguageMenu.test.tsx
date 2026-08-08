import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import LanguageMenu from '../LanguageMenu';
import { ColorModeProvider } from '../../ColorModeContext';

describe('LanguageMenu', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('renders a language button', () => {
    render(
      <ColorModeProvider>
        <LanguageMenu />
      </ColorModeProvider>,
    );
    expect(screen.getByRole('button')).toBeInTheDocument();
  });

  it('opens the menu and lists all locales', async () => {
    render(
      <ColorModeProvider>
        <LanguageMenu />
      </ColorModeProvider>,
    );
    fireEvent.click(screen.getByRole('button'));
    expect(await screen.findByText('English (India)')).toBeInTheDocument();
    expect(screen.getByText('हिन्दी (India)')).toBeInTheDocument();
    expect(screen.getByText('Русский (Russia)')).toBeInTheDocument();
    expect(screen.getByText('Norsk (Norge)')).toBeInTheDocument();
    expect(screen.getByText('Polski (Polska)')).toBeInTheDocument();
    expect(screen.getByText('ไทย (Thailand)')).toBeInTheDocument();
    expect(screen.getByText('中文 (Singapore)')).toBeInTheDocument();
    expect(screen.getByText('עברית (Israel)')).toBeInTheDocument();
    expect(screen.getByText('العربية (Saudi Arabia)')).toBeInTheDocument();
    expect(screen.getByText('العربية (Jordan)')).toBeInTheDocument();
  });

  it('switches the language and persists the selection', async () => {
    render(
      <ColorModeProvider>
        <LanguageMenu />
      </ColorModeProvider>,
    );
    fireEvent.click(screen.getByRole('button'));
    const option = await screen.findByText('Español (México)');
    fireEvent.click(option);
    await waitFor(() => expect(localStorage.getItem('encodex-lang')).toBe('es-MX'));
  });
});
