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
    expect(screen.getByText('Português (Portugal)')).toBeInTheDocument();
    expect(screen.getByText('नेपाली (Nepal)')).toBeInTheDocument();
    expect(screen.getByText('ភាសាខ្មែរ (Cambodia)')).toBeInTheDocument();
    expect(screen.getByText('Tiếng Việt (Vietnam)')).toBeInTheDocument();
    expect(screen.getByText('ລາວ (Laos)')).toBeInTheDocument();
    expect(screen.getByText('中文 (Taiwan)')).toBeInTheDocument();
    expect(screen.getByText('Māori (New Zealand)')).toBeInTheDocument();
    expect(screen.getByText('Íslenska (Iceland)')).toBeInTheDocument();
    expect(screen.getByText('Kalaallisut (Greenland)')).toBeInTheDocument();
    expect(screen.getByText('Gaeilge (Ireland)')).toBeInTheDocument();
    expect(screen.getByText('Suomi (Finland)')).toBeInTheDocument();
    expect(screen.getByText('Dansk (Danmark)')).toBeInTheDocument();
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
