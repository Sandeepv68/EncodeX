import { describe, it, expect } from 'vitest';
import { IPC } from '../ipc-channels';

describe('IPC channels', () => {
  it('defines all request channels as unique strings', () => {
    const channels = Object.values(IPC);
    expect(new Set(channels).size).toBe(channels.length);
    expect(IPC.SELECT_FILE).toBe('select-file');
    expect(IPC.SELECT_FILES).toBe('select-files');
    expect(IPC.SELECT_OUTPUT).toBe('select-output');
    expect(IPC.SELECT_DIRECTORY).toBe('select-directory');
    expect(IPC.GET_MEDIA_INFO).toBe('get-media-info');
    expect(IPC.GET_IMAGE_INFO).toBe('get-image-info');
    expect(IPC.GET_IMAGE_PREVIEW).toBe('get-image-preview');
    expect(IPC.GET_IMAGE_FILE_INFO).toBe('get-image-file-info');
    expect(IPC.CONVERT_FILE).toBe('convert-file');
    expect(IPC.CANCEL_CONVERSION).toBe('cancel-conversion');
    expect(IPC.PAUSE_CONVERSION).toBe('pause-conversion');
    expect(IPC.RESUME_CONVERSION).toBe('resume-conversion');
    expect(IPC.QUEUE_ADD).toBe('queue-add');
    expect(IPC.QUEUE_REMOVE).toBe('queue-remove');
    expect(IPC.QUEUE_LIST).toBe('queue-list');
    expect(IPC.QUEUE_CANCEL_ALL).toBe('queue-cancel-all');
    expect(IPC.QUEUE_CLEAR_COMPLETED).toBe('queue-clear-completed');
    expect(IPC.QUEUE_SET_CONCURRENCY).toBe('queue-set-concurrency');
    expect(IPC.QUEUE_MOVE_TO).toBe('queue-move-to');
    expect(IPC.QUEUE_PAUSE).toBe('queue-pause');
    expect(IPC.QUEUE_RESUME).toBe('queue-resume');
    expect(IPC.QUEUE_EXPORT).toBe('queue-export');
    expect(IPC.QUEUE_IMPORT).toBe('queue-import');
    expect(IPC.PLAYER_OPEN).toBe('player-open');
    expect(IPC.PLAYER_SEEK).toBe('player-seek');
    expect(IPC.PLAYER_CLOSE).toBe('player-close');
    expect(IPC.PLAYER_GET_FRAME).toBe('player-get-frame');
    expect(IPC.PLAYER_AUDIO).toBe('player-audio');
    expect(IPC.PLAYER_ERROR).toBe('player-error');
  });

  it('defines all event channels as unique strings', () => {
    expect(IPC.CONVERSION_PROGRESS).toBe('conversion-progress');
    expect(IPC.QUEUE_ADDED).toBe('queue-added');
    expect(IPC.QUEUE_REMOVED).toBe('queue-removed');
    expect(IPC.QUEUE_STATUS_CHANGE).toBe('queue-status-change');
    expect(IPC.QUEUE_PROGRESS).toBe('queue-progress');
    expect(IPC.QUEUE_CANCELLED).toBe('queue-cancelled');
    expect(IPC.QUEUE_MOVED).toBe('queue-moved');
    expect(IPC.PLAYER_FRAME).toBe('player-frame');
    expect(IPC.PLAYER_AUDIO).toBe('player-audio');
    expect(IPC.PLAYER_ERROR).toBe('player-error');
    expect(IPC.LOG_MESSAGE).toBe('log-message');
  });
});
