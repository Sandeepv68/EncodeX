import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import ProfileEditorDialog from '../ProfileEditorDialog';
import { useProfileStore } from '../../stores/profileStore';
import { useToastStore } from '../../stores/toastStore';
import { PROFILE_CATEGORIES, CATEGORY_ORDER } from '../../../shared/profiles/categories';

function selectMuiOption(comboboxIndex: number, optionText: string) {
  const comboboxes = screen.getAllByRole('combobox');
  fireEvent.mouseDown(comboboxes[comboboxIndex]);
  fireEvent.click(screen.getByText(optionText));
}

const COMBOS = {
  category: 0,
  container: 1,
  videoCodec: 2,
  audioCodec: 3,
  quality: 4,
  preset: 5,
  resolution: 6,
  pixelFormat: 7,
  videoBitrate: 8,
  audioBitrate: 9,
};

describe('ProfileEditorDialog', () => {
  beforeEach(() => {
    localStorage.clear();
    useProfileStore.setState({
      selectedCategory: null,
      recentProfileIds: [],
      profiles: useProfileStore.getState().profiles.filter((p) => p.builtin),
    });
    useToastStore.setState({ toasts: [] });
  });

  it('does not render when closed', () => {
    render(<ProfileEditorDialog open={false} onClose={vi.fn()} />);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('renders the create dialog when open without editProfile', () => {
    render(<ProfileEditorDialog open={true} onClose={vi.fn()} />);
    expect(screen.getByText('profiles.createTitle')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'profiles.createProfile' })).toBeInTheDocument();
  });

  it('renders the edit dialog when open with editProfile', () => {
    const editProfile = {
      id: 'custom-1',
      name: 'Existing Profile',
      category: 'video' as const,
      container: 'mkv',
      videoCodec: 'libx265',
      audioCodec: 'aac',
      builtin: false,
    };
    render(<ProfileEditorDialog open={true} onClose={vi.fn()} editProfile={editProfile} />);
    expect(screen.getByText('profiles.editTitle')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'profiles.saveChanges' })).toBeInTheDocument();
    expect(screen.getByDisplayValue('Existing Profile')).toBeInTheDocument();
  });

  it('calls onClose when cancel is clicked', () => {
    const onClose = vi.fn();
    render(<ProfileEditorDialog open={true} onClose={onClose} />);
    fireEvent.click(screen.getByRole('button', { name: 'profiles.cancel' }));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('save button is disabled when name is empty', () => {
    render(<ProfileEditorDialog open={true} onClose={vi.fn()} />);
    const saveBtn = screen.getByRole('button', { name: 'profiles.createProfile' });
    expect(saveBtn).toBeDisabled();
  });

  it('save button is enabled when name is provided', () => {
    render(<ProfileEditorDialog open={true} onClose={vi.fn()} />);
    fireEvent.change(screen.getByLabelText('profiles.nameLabel'), { target: { value: 'My Profile' } });
    const saveBtn = screen.getByRole('button', { name: 'profiles.createProfile' });
    expect(saveBtn).toBeEnabled();
  });

  it('creates a custom profile on save', () => {
    const onClose = vi.fn();
    render(<ProfileEditorDialog open={true} onClose={onClose} />);
    fireEvent.change(screen.getByLabelText('profiles.nameLabel'), { target: { value: 'New Profile' } });
    fireEvent.click(screen.getByRole('button', { name: 'profiles.createProfile' }));
    expect(onClose).toHaveBeenCalledOnce();
    const custom = useProfileStore.getState().profiles.filter((p) => !p.builtin);
    expect(custom.length).toBe(1);
    expect(custom[0].name).toBe('New Profile');
  });

  it('shows a success toast after creating', () => {
    render(<ProfileEditorDialog open={true} onClose={vi.fn()} />);
    fireEvent.change(screen.getByLabelText('profiles.nameLabel'), { target: { value: 'Toast Profile' } });
    fireEvent.click(screen.getByRole('button', { name: 'profiles.createProfile' }));
    expect(useToastStore.getState().toasts.some((t) => t.type === 'success')).toBe(true);
  });

  it('updates an existing profile on save when editProfile is provided', () => {
    const id = useProfileStore.getState().saveCustomProfile({
      name: 'Original',
      category: 'video',
      container: 'mp4',
      videoCodec: 'libx264',
      audioCodec: 'aac',
    });
    const editProfile = useProfileStore.getState().getProfileById(id)!;
    const onClose = vi.fn();
    render(<ProfileEditorDialog open={true} onClose={onClose} editProfile={editProfile} />);
    fireEvent.change(screen.getByLabelText('profiles.nameLabel'), { target: { value: 'Updated' } });
    fireEvent.click(screen.getByRole('button', { name: 'profiles.saveChanges' }));
    expect(onClose).toHaveBeenCalledOnce();
    expect(useProfileStore.getState().getProfileById(id)!.name).toBe('Updated');
  });

  it('shows a success toast after updating', () => {
    const id = useProfileStore.getState().saveCustomProfile({
      name: 'Original',
      category: 'video',
      container: 'mp4',
      videoCodec: 'libx264',
      audioCodec: 'aac',
    });
    const editProfile = useProfileStore.getState().getProfileById(id)!;
    render(<ProfileEditorDialog open={true} onClose={vi.fn()} editProfile={editProfile} />);
    fireEvent.change(screen.getByLabelText('profiles.nameLabel'), { target: { value: 'Updated' } });
    fireEvent.click(screen.getByRole('button', { name: 'profiles.saveChanges' }));
    expect(useToastStore.getState().toasts.some((t) => t.type === 'success')).toBe(true);
  });

  it('defaults to the correct form values when creating', () => {
    render(<ProfileEditorDialog open={true} onClose={vi.fn()} />);
    expect(screen.getByText('.mp4')).toBeInTheDocument();
    expect(screen.getByText('H.264 (libx264)')).toBeInTheDocument();
    expect(screen.getByText('AAC (native)')).toBeInTheDocument();
  });

  it('populates form with editProfile values', () => {
    const editProfile = {
      id: 'custom-1',
      name: 'Test',
      category: 'audio' as const,
      container: 'mp3',
      videoCodec: '',
      audioCodec: 'libmp3lame',
      videoBitrate: '320k',
      audioBitrate: '256k',
      crf: 10,
      preset: 'fast',
      scale: '1280x720',
      pixelFormat: 'yuv444p',
      builtin: false,
    };
    render(<ProfileEditorDialog open={true} onClose={vi.fn()} editProfile={editProfile} />);
    expect(screen.getByDisplayValue('Test')).toBeInTheDocument();
    expect(screen.getByText('.mp3')).toBeInTheDocument();
    expect(screen.getByText('MP3 (LAME)')).toBeInTheDocument();
    expect(screen.getByText('10')).toBeInTheDocument();
    expect(screen.getByText('fast')).toBeInTheDocument();
  });

  it('toggles advanced options section', () => {
    render(<ProfileEditorDialog open={true} onClose={vi.fn()} />);
    const advBtn = screen.getByText('profiles.advancedOptions');
    expect(advBtn).toBeInTheDocument();
    fireEvent.click(advBtn);
    expect(screen.getByLabelText('profiles.extensionOverrideLabel')).toBeInTheDocument();
    expect(screen.getByLabelText('profiles.extraArgsLabel')).toBeInTheDocument();
  });

  it('advanced options collapse on second click', () => {
    render(<ProfileEditorDialog open={true} onClose={vi.fn()} />);
    const advBtn = screen.getByText('profiles.advancedOptions');
    fireEvent.click(advBtn);
    expect(screen.getByLabelText('profiles.extensionOverrideLabel')).toBeInTheDocument();
    fireEvent.click(advBtn);
    expect(screen.getByLabelText('profiles.extensionOverrideLabel')).toBeInTheDocument();
  });

  it('resets form when dialog reopens', () => {
    const { rerender } = render(<ProfileEditorDialog open={false} onClose={vi.fn()} />);
    rerender(<ProfileEditorDialog open={true} onClose={vi.fn()} />);
    expect(screen.getByLabelText('profiles.nameLabel')).toHaveValue('');
  });

  it('resets form when editProfile changes', () => {
    const profile1 = {
      id: 'c1',
      name: 'First',
      category: 'video' as const,
      container: 'mp4',
      videoCodec: 'libx264',
      audioCodec: 'aac',
      builtin: false,
    };
    const profile2 = {
      id: 'c2',
      name: 'Second',
      category: 'audio' as const,
      container: 'mp3',
      videoCodec: '',
      audioCodec: 'libmp3lame',
      builtin: false,
    };
    const { rerender } = render(<ProfileEditorDialog open={true} onClose={vi.fn()} editProfile={profile1} />);
    expect(screen.getByDisplayValue('First')).toBeInTheDocument();
    rerender(<ProfileEditorDialog open={true} onClose={vi.fn()} editProfile={profile2} />);
    expect(screen.getByDisplayValue('Second')).toBeInTheDocument();
  });

  it('populates advanced fields from editProfile', () => {
    const editProfile = {
      id: 'custom-1',
      name: 'Advanced',
      category: 'video' as const,
      container: 'mkv',
      videoCodec: 'libx264',
      audioCodec: 'aac',
      extension: 'myext',
      extraArgs: ['-movflags', '+faststart'],
      builtin: false,
    };
    render(<ProfileEditorDialog open={true} onClose={vi.fn()} editProfile={editProfile} />);
    fireEvent.click(screen.getByText('profiles.advancedOptions'));
    expect(screen.getByLabelText('profiles.extensionOverrideLabel')).toHaveValue('myext');
    expect(screen.getByLabelText('profiles.extraArgsLabel')).toHaveValue('-movflags +faststart');
  });

  it('saves extraArgs as array when advanced fields are filled', () => {
    render(<ProfileEditorDialog open={true} onClose={vi.fn()} />);
    fireEvent.change(screen.getByLabelText('profiles.nameLabel'), { target: { value: 'ExtraArgs' } });
    fireEvent.click(screen.getByText('profiles.advancedOptions'));
    fireEvent.change(screen.getByLabelText('profiles.extraArgsLabel'), { target: { value: '-movflags +faststart' } });
    fireEvent.click(screen.getByRole('button', { name: 'profiles.createProfile' }));
    const custom = useProfileStore.getState().profiles.filter((p) => !p.builtin);
    expect(custom[0].extraArgs).toEqual(['-movflags', '+faststart']);
  });

  it('saves extension override from advanced fields', () => {
    render(<ProfileEditorDialog open={true} onClose={vi.fn()} />);
    fireEvent.change(screen.getByLabelText('profiles.nameLabel'), { target: { value: 'ExtOverride' } });
    fireEvent.click(screen.getByText('profiles.advancedOptions'));
    fireEvent.change(screen.getByLabelText('profiles.extensionOverrideLabel'), { target: { value: 'custom' } });
    fireEvent.click(screen.getByRole('button', { name: 'profiles.createProfile' }));
    const custom = useProfileStore.getState().profiles.filter((p) => !p.builtin);
    expect(custom[0].extension).toBe('custom');
  });

  it('sets category via the category dropdown', () => {
    render(<ProfileEditorDialog open={true} onClose={vi.fn()} />);
    fireEvent.change(screen.getByLabelText('profiles.nameLabel'), { target: { value: 'Cat Test' } });
    selectMuiOption(COMBOS.category, PROFILE_CATEGORIES['advanced'].label);
    fireEvent.click(screen.getByRole('button', { name: 'profiles.createProfile' }));
    const custom = useProfileStore.getState().profiles.filter((p) => !p.builtin);
    expect(custom[0].category).toBe('advanced');
  });

  it('sets container via the container dropdown', () => {
    render(<ProfileEditorDialog open={true} onClose={vi.fn()} />);
    fireEvent.change(screen.getByLabelText('profiles.nameLabel'), { target: { value: 'Container Test' } });
    selectMuiOption(COMBOS.container, '.mkv');
    fireEvent.click(screen.getByRole('button', { name: 'profiles.createProfile' }));
    const custom = useProfileStore.getState().profiles.filter((p) => !p.builtin);
    expect(custom[0].container).toBe('mkv');
  });

  it('sets video codec via the video codec dropdown', () => {
    render(<ProfileEditorDialog open={true} onClose={vi.fn()} />);
    fireEvent.change(screen.getByLabelText('profiles.nameLabel'), { target: { value: 'Codec Test' } });
    selectMuiOption(COMBOS.videoCodec, 'H.265/HEVC (libx265)');
    fireEvent.click(screen.getByRole('button', { name: 'profiles.createProfile' }));
    const custom = useProfileStore.getState().profiles.filter((p) => !p.builtin);
    expect(custom[0].videoCodec).toBe('libx265');
  });

  it('sets audio codec via the audio codec dropdown', () => {
    render(<ProfileEditorDialog open={true} onClose={vi.fn()} />);
    fireEvent.change(screen.getByLabelText('profiles.nameLabel'), { target: { value: 'Codec Test' } });
    selectMuiOption(COMBOS.audioCodec, 'MP3 (LAME)');
    fireEvent.click(screen.getByRole('button', { name: 'profiles.createProfile' }));
    const custom = useProfileStore.getState().profiles.filter((p) => !p.builtin);
    expect(custom[0].audioCodec).toBe('libmp3lame');
  });

  it('sets quality via the quality dropdown', () => {
    render(<ProfileEditorDialog open={true} onClose={vi.fn()} />);
    fireEvent.change(screen.getByLabelText('profiles.nameLabel'), { target: { value: 'Q Test' } });
    selectMuiOption(COMBOS.quality, '18');
    fireEvent.click(screen.getByRole('button', { name: 'profiles.createProfile' }));
    const custom = useProfileStore.getState().profiles.filter((p) => !p.builtin);
    expect(custom[0].crf).toBe(18);
  });

  it('sets preset via the preset dropdown', () => {
    render(<ProfileEditorDialog open={true} onClose={vi.fn()} />);
    fireEvent.change(screen.getByLabelText('profiles.nameLabel'), { target: { value: 'P Test' } });
    selectMuiOption(COMBOS.preset, 'slow');
    fireEvent.click(screen.getByRole('button', { name: 'profiles.createProfile' }));
    const custom = useProfileStore.getState().profiles.filter((p) => !p.builtin);
    expect(custom[0].preset).toBe('slow');
  });

  it('sets description via the description field', () => {
    render(<ProfileEditorDialog open={true} onClose={vi.fn()} />);
    fireEvent.change(screen.getByLabelText('profiles.nameLabel'), { target: { value: 'Desc Test' } });
    fireEvent.change(screen.getByLabelText('profiles.descriptionLabel'), { target: { value: 'My description' } });
    fireEvent.click(screen.getByRole('button', { name: 'profiles.createProfile' }));
    const custom = useProfileStore.getState().profiles.filter((p) => !p.builtin);
    expect(custom[0].description).toBe('My description');
  });

  it('sets video bitrate and audio bitrate', () => {
    render(<ProfileEditorDialog open={true} onClose={vi.fn()} />);
    fireEvent.change(screen.getByLabelText('profiles.nameLabel'), { target: { value: 'Bitrate Test' } });
    selectMuiOption(COMBOS.videoBitrate, '4000k');
    selectMuiOption(COMBOS.audioBitrate, '320k');
    fireEvent.click(screen.getByRole('button', { name: 'profiles.createProfile' }));
    const custom = useProfileStore.getState().profiles.filter((p) => !p.builtin);
    expect(custom[0].videoBitrate).toBe('4000k');
    expect(custom[0].audioBitrate).toBe('320k');
  });

  it('sets scale and pixel format', () => {
    render(<ProfileEditorDialog open={true} onClose={vi.fn()} />);
    fireEvent.change(screen.getByLabelText('profiles.nameLabel'), { target: { value: 'Scale Test' } });
    selectMuiOption(COMBOS.resolution, '1920x1080');
    selectMuiOption(COMBOS.pixelFormat, 'yuv444p');
    fireEvent.click(screen.getByRole('button', { name: 'profiles.createProfile' }));
    const custom = useProfileStore.getState().profiles.filter((p) => !p.builtin);
    expect(custom[0].scale).toBe('1920x1080');
    expect(custom[0].pixelFormat).toBe('yuv444p');
  });

  it('empty optional fields are saved as undefined', () => {
    render(<ProfileEditorDialog open={true} onClose={vi.fn()} />);
    fireEvent.change(screen.getByLabelText('profiles.nameLabel'), { target: { value: 'Undefined Test' } });
    fireEvent.click(screen.getByRole('button', { name: 'profiles.createProfile' }));
    const custom = useProfileStore.getState().profiles.filter((p) => !p.builtin);
    expect(custom[0].videoBitrate).toBeUndefined();
    expect(custom[0].scale).toBeUndefined();
    expect(custom[0].extension).toBeUndefined();
    expect(custom[0].extraArgs).toBeUndefined();
    expect(custom[0].description).toBeUndefined();
  });

  it('closes and resets advanced state on reopen', () => {
    const { rerender } = render(<ProfileEditorDialog open={true} onClose={vi.fn()} />);
    fireEvent.click(screen.getByText('profiles.advancedOptions'));
    expect(screen.getByLabelText('profiles.extensionOverrideLabel')).toBeInTheDocument();
    rerender(<ProfileEditorDialog open={false} onClose={vi.fn()} />);
    rerender(<ProfileEditorDialog open={true} onClose={vi.fn()} />);
    fireEvent.click(screen.getByText('profiles.advancedOptions'));
    expect(screen.getByLabelText('profiles.extensionOverrideLabel')).toBeInTheDocument();
  });
});
