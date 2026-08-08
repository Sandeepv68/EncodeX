import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import AppDrawer from '../AppDrawer';
import { ColorModeProvider } from '../../ColorModeContext';
import { useConversionStore } from '../../stores/conversionStore';
import { useVideoCutStore } from '../../stores/videoCutStore';
import { useQueueStore } from '../../stores/queueStore';
import { QUEUE_STATUS } from '../../../shared/media-options';

function LocationProbe() {
  const location = useLocation();
  return <span data-testid="location">{location.pathname}</span>;
}

function renderDrawer({ isMobile = false, onNavigate = vi.fn() } = {}) {
  return render(
    <MemoryRouter initialEntries={['/convert']}>
      <ColorModeProvider>
        <AppDrawer isMobile={isMobile} onNavigate={onNavigate} />
        <LocationProbe />
      </ColorModeProvider>
    </MemoryRouter>,
  );
}

describe('AppDrawer', () => {
  beforeEach(() => {
    localStorage.clear();
    useConversionStore.getState().setIsConverting(false);
    useVideoCutStore.getState().setIsCutting(false);
    useQueueStore.getState().setJobs([]);
  });

  it('renders the nav items', () => {
    renderDrawer();
    expect(screen.queryByText('app.name')).not.toBeInTheDocument();
    expect(screen.getByText('nav.dashboard')).toBeInTheDocument();
    expect(screen.getByText('nav.convert')).toBeInTheDocument();
    expect(screen.getByText('nav.batchQueue')).toBeInTheDocument();
    expect(screen.getByText('nav.settings')).toBeInTheDocument();
  });

  it('navigates to the clicked route', () => {
    renderDrawer();
    expect(screen.getByTestId('location')).toHaveTextContent('/convert');
    fireEvent.click(screen.getByText('nav.dashboard'));
    expect(screen.getByTestId('location')).toHaveTextContent('/');
  });

  it('calls onNavigate on mobile when a nav item is clicked', () => {
    const onNavigate = vi.fn();
    renderDrawer({ isMobile: true, onNavigate });
    fireEvent.click(screen.getByText('nav.logs'));
    expect(onNavigate).toHaveBeenCalledOnce();
  });

  it('does not call onNavigate on desktop', () => {
    const onNavigate = vi.fn();
    renderDrawer({ isMobile: false, onNavigate });
    fireEvent.click(screen.getByText('nav.logs'));
    expect(onNavigate).not.toHaveBeenCalled();
  });

  it('navigates to the settings page when its nav item is clicked', () => {
    renderDrawer();
    fireEvent.click(screen.getByText('nav.settings'));
    expect(screen.getByTestId('location')).toHaveTextContent('/settings');
  });

  it('shows a blip on the convert item while a conversion is in progress', () => {
    useConversionStore.getState().setIsConverting(true);
    renderDrawer();
    expect(screen.getByTestId('nav-convert-blip')).toBeInTheDocument();
  });

  it('hides the blip when no conversion is in progress', () => {
    renderDrawer();
    expect(screen.queryByTestId('nav-convert-blip')).not.toBeInTheDocument();
  });

  it('shows a blip on the video-cut item while a cut is in progress', () => {
    useVideoCutStore.getState().setIsCutting(true);
    renderDrawer();
    expect(screen.getByTestId('nav-video-cut-blip')).toBeInTheDocument();
  });

  it('hides the video-cut blip when no cut is in progress', () => {
    renderDrawer();
    expect(screen.queryByTestId('nav-video-cut-blip')).not.toBeInTheDocument();
  });

  it('shows a blip on the batch item while a queued job is running', () => {
    useQueueStore.getState().setJobs([
      {
        id: '1',
        input: 'in.mp4',
        output: 'out.mp4',
        options: {},
        transcoder: 'FFMPEG',
        status: QUEUE_STATUS.RUNNING,
        progress: 50,
        createdAt: 1,
      },
    ]);
    renderDrawer();
    expect(screen.getByTestId('nav-batch-blip')).toBeInTheDocument();
  });

  it('hides the batch blip when no queued job is running', () => {
    useQueueStore.getState().setJobs([
      {
        id: '1',
        input: 'in.mp4',
        output: 'out.mp4',
        options: {},
        transcoder: 'FFMPEG',
        status: QUEUE_STATUS.QUEUED,
        progress: 0,
        createdAt: 1,
      },
    ]);
    renderDrawer();
    expect(screen.queryByTestId('nav-batch-blip')).not.toBeInTheDocument();
  });
});
