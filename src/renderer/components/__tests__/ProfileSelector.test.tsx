import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, within, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ProfileSelector from '../ProfileSelector';
import { useProfileStore } from '../../stores/profileStore';
import { useToastStore } from '../../stores/toastStore';
import { PROFILE_CATEGORIES } from '../../../shared/profiles/categories';
import { CATEGORY_ORDER } from '../../../shared/profiles/categories';

const firstCategoryLabel = PROFILE_CATEGORIES[CATEGORY_ORDER[0]].label;

describe('ProfileSelector', () => {
  beforeEach(() => {
    localStorage.clear();
    useProfileStore.setState({
      selectedCategory: null,
      recentProfileIds: [],
      profiles: useProfileStore.getState().profiles.filter((p) => p.builtin),
    });
    useToastStore.setState({ toasts: [] });
  });

  it('renders the search field', () => {
    render(<ProfileSelector />);
    expect(screen.getByPlaceholderText('profiles.searchPlaceholder')).toBeInTheDocument();
  });

  it('renders with the profile-selector data-testid by default', () => {
    render(<ProfileSelector />);
    expect(screen.getByTestId('profile-selector')).toBeInTheDocument();
  });

  it('renders with a custom testId', () => {
    render(<ProfileSelector testId="my-selector" />);
    expect(screen.getByTestId('my-selector')).toBeInTheDocument();
  });

  it('shows builtin profiles in the dropdown', async () => {
    render(<ProfileSelector />);
    fireEvent.mouseDown(screen.getByRole('combobox'));
    const listbox = await screen.findByRole('listbox');
    expect(within(listbox).getAllByRole('option').length).toBeGreaterThan(0);
  });

  it('shows the "Create Custom Profile" option in dropdown', async () => {
    const onCreateNew = vi.fn();
    render(<ProfileSelector onCreateNew={onCreateNew} />);
    fireEvent.mouseDown(screen.getByRole('combobox'));
    expect(await screen.findByText('profiles.createCustom')).toBeInTheDocument();
  });

  it('calls onCreateNew when "Create Custom Profile" is clicked', async () => {
    const onCreateNew = vi.fn();
    render(<ProfileSelector onCreateNew={onCreateNew} />);
    fireEvent.mouseDown(screen.getByRole('combobox'));
    fireEvent.click(await screen.findByText('profiles.createCustom'));
    expect(onCreateNew).toHaveBeenCalledOnce();
  });

  it('calls onCreateNew on mousedown so MUI does not swallow the click', async () => {
    const onCreateNew = vi.fn();
    render(<ProfileSelector onCreateNew={onCreateNew} />);
    fireEvent.mouseDown(screen.getByRole('combobox'));
    const card = await screen.findByText('profiles.createCustom');
    fireEvent.mouseDown(card);
    expect(onCreateNew).toHaveBeenCalledOnce();
  });

  it('filters profiles when typing in the search field', async () => {
    const user = userEvent.setup();
    render(<ProfileSelector />);
    fireEvent.mouseDown(screen.getByRole('combobox'));
    await screen.findByRole('listbox');
    const input = screen.getByRole('combobox');
    await act(async () => {
      await user.type(input, 'YouTube');
    });
    const options = screen.getAllByRole('option');
    expect(options.length).toBeGreaterThan(0);
    expect(options.length).toBeLessThan(
      useProfileStore.getState().profiles.filter((p) => p.id !== 'null-output' && p.id !== 'custom-ffmpeg').length,
    );
  });

  it('selecting a profile applies it and shows the active chip', async () => {
    render(<ProfileSelector />);
    fireEvent.mouseDown(screen.getByRole('combobox'));
    const options = await screen.findAllByRole('option');
    fireEvent.click(options[0]);
    expect(useProfileStore.getState().recentProfileIds.length).toBeGreaterThan(0);
    expect(screen.getByTestId('profile-badge')).toBeInTheDocument();
  });

  it('shows a delete button for custom profiles only', async () => {
    useProfileStore.getState().saveCustomProfile({
      name: 'Custom Test',
      category: 'video',
      container: 'mkv',
      videoCodec: 'libx264',
      audioCodec: 'aac',
    });
    render(<ProfileSelector />);
    fireEvent.mouseDown(screen.getByRole('combobox'));
    const options = await screen.findAllByRole('option');
    const customOption = options.find((o) => o.textContent?.includes('Custom Test'));
    expect(customOption).toBeDefined();
    const deleteBtn = customOption!.querySelector('[role="button"]');
    expect(deleteBtn).toBeInTheDocument();
  });

  it('does not show delete button for builtin profiles', async () => {
    render(<ProfileSelector />);
    fireEvent.mouseDown(screen.getByRole('combobox'));
    const options = await screen.findAllByRole('option');
    const firstOption = options[0];
    const deleteBtn = firstOption.querySelector('[role="button"]');
    expect(deleteBtn).not.toBeInTheDocument();
  });

  it('opens delete confirmation dialog when delete is clicked', async () => {
    useProfileStore.getState().saveCustomProfile({
      name: 'To Delete',
      category: 'audio',
      container: 'mp3',
      videoCodec: '',
      audioCodec: 'libmp3lame',
    });
    render(<ProfileSelector />);
    fireEvent.mouseDown(screen.getByRole('combobox'));
    const option = await screen.findByText(/To Delete/);
    const deleteBtn = option.closest('li')!.querySelector('[role="button"]')!;
    fireEvent.click(deleteBtn);
    expect(screen.getByText('profiles.deleteTitle')).toBeInTheDocument();
  });

  it('confirms deletion and removes the profile', async () => {
    const id = useProfileStore.getState().saveCustomProfile({
      name: 'Delete Me',
      category: 'video',
      container: 'mp4',
      videoCodec: 'libx264',
      audioCodec: 'aac',
    });
    render(<ProfileSelector />);
    fireEvent.mouseDown(screen.getByRole('combobox'));
    const option = await screen.findByText(/Delete Me/);
    const deleteBtn = option.closest('li')!.querySelector('[role="button"]')!;
    fireEvent.click(deleteBtn);
    fireEvent.click(screen.getByRole('button', { name: /profiles\.deleteConfirm|Delete/i }));
    expect(useProfileStore.getState().getProfileById(id)).toBeUndefined();
  });

  it('cancels deletion when dialog is closed', async () => {
    const id = useProfileStore.getState().saveCustomProfile({
      name: 'Keep Me',
      category: 'video',
      container: 'mp4',
      videoCodec: 'libx264',
      audioCodec: 'aac',
    });
    render(<ProfileSelector />);
    fireEvent.mouseDown(screen.getByRole('combobox'));
    const option = await screen.findByText(/Keep Me/);
    const deleteBtn = option.closest('li')!.querySelector('[role="button"]')!;
    fireEvent.click(deleteBtn);
    fireEvent.click(screen.getByRole('button', { name: /profiles\.cancel|Cancel/i }));
    expect(useProfileStore.getState().getProfileById(id)).toBeDefined();
  });

  it('shows a toast after deleting a profile', async () => {
    const id = useProfileStore.getState().saveCustomProfile({
      name: 'Toast Test',
      category: 'video',
      container: 'mp4',
      videoCodec: 'libx264',
      audioCodec: 'aac',
    });
    render(<ProfileSelector />);
    fireEvent.mouseDown(screen.getByRole('combobox'));
    const option = await screen.findByText(/Toast Test/);
    const deleteBtn = option.closest('li')!.querySelector('[role="button"]')!;
    fireEvent.click(deleteBtn);
    fireEvent.click(screen.getByRole('button', { name: /profiles\.deleteConfirm|Delete/i }));
    expect(useToastStore.getState().toasts.some((t) => t.type === 'error')).toBe(true);
  });

  it('renders category group headers', async () => {
    render(<ProfileSelector />);
    fireEvent.mouseDown(screen.getByRole('combobox'));
    await screen.findByRole('listbox');
    expect(screen.getByText(firstCategoryLabel)).toBeInTheDocument();
  });

  it('shows the active profile as a chip and hides the autocomplete', async () => {
    render(<ProfileSelector />);
    fireEvent.mouseDown(screen.getByRole('combobox'));
    const options = await screen.findAllByRole('option');
    fireEvent.click(options[0]);
    expect(screen.getAllByTestId('profile-badge')).toHaveLength(1);
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
  });

  it('search highlights matching text', async () => {
    const user = userEvent.setup();
    render(<ProfileSelector />);
    fireEvent.mouseDown(screen.getByRole('combobox'));
    await screen.findByRole('listbox');
    const input = screen.getByRole('combobox');
    await act(async () => {
      await user.type(input, 'YouTube');
    });
    const options = screen.getAllByRole('option');
    const firstOption = options[0];
    const spans = firstOption.querySelectorAll('span');
    expect(spans.length).toBeGreaterThan(0);
  });

  it('search is case-insensitive', async () => {
    const user = userEvent.setup();
    render(<ProfileSelector />);
    fireEvent.mouseDown(screen.getByRole('combobox'));
    await screen.findByRole('listbox');
    const input = screen.getByRole('combobox');
    await act(async () => {
      await user.type(input, 'youtube');
    });
    const options = screen.getAllByRole('option');
    expect(options.length).toBeGreaterThan(0);
  });

  it('searches by description as well as name', async () => {
    useProfileStore.getState().saveCustomProfile({
      name: 'My Custom',
      category: 'video',
      container: 'mp4',
      videoCodec: 'libx264',
      audioCodec: 'aac',
      description: 'Unique description text',
    });
    const user = userEvent.setup();
    render(<ProfileSelector />);
    fireEvent.mouseDown(screen.getByRole('combobox'));
    await screen.findByRole('listbox');
    const input = screen.getByRole('combobox');
    await act(async () => {
      await user.type(input, 'Unique description text');
    });
    const options = screen.getAllByRole('option');
    expect(options.length).toBe(1);
  });

  it('shows description below name in options', async () => {
    useProfileStore.getState().saveCustomProfile({
      name: 'Desc Test',
      category: 'video',
      container: 'mp4',
      videoCodec: 'libx264',
      audioCodec: 'aac',
      description: 'A detailed description',
    });
    render(<ProfileSelector />);
    fireEvent.mouseDown(screen.getByRole('combobox'));
    expect(await screen.findByText('A detailed description')).toBeInTheDocument();
  });

  it('hides hidden profiles (null-output, custom-ffmpeg)', async () => {
    render(<ProfileSelector />);
    fireEvent.mouseDown(screen.getByRole('combobox'));
    await screen.findByRole('listbox');
    const options = screen.getAllByRole('option');
    expect(options.every((o) => !o.textContent?.includes('null-output'))).toBe(true);
    expect(options.every((o) => !o.textContent?.includes('custom-ffmpeg'))).toBe(true);
  });

  it('renders with MUI Autocomplete role="combobox"', () => {
    render(<ProfileSelector />);
    expect(screen.getByRole('combobox')).toBeInTheDocument();
  });

  it('does not call onCreateNew when onCreateNew is not provided', async () => {
    render(<ProfileSelector />);
    fireEvent.mouseDown(screen.getByRole('combobox'));
    expect(screen.queryByText('profiles.createCustom')).not.toBeInTheDocument();
  });

  it('selecting a profile with description shows name and description', async () => {
    useProfileStore.getState().saveCustomProfile({
      name: 'Format Test',
      category: 'video',
      container: 'mp4',
      videoCodec: 'libx264',
      audioCodec: 'aac',
      description: 'My description',
    });
    render(<ProfileSelector />);
    fireEvent.mouseDown(screen.getByRole('combobox'));
    expect(await screen.findByText(/Format Test/)).toBeInTheDocument();
    expect(screen.getByText(/My description/)).toBeInTheDocument();
  });
});
