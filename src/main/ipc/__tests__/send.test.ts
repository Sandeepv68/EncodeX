import { describe, it, expect, vi } from 'vitest';

vi.mock('electron', () => ({ BrowserWindow: class {} }));

const { createSender } = await import('../send');

describe('createSender', () => {
  it('sends the channel and args when the window is alive', () => {
    const send = vi.fn();
    const win = { isDestroyed: () => false, webContents: { send } };
    const sender = createSender(win as never);
    sender('some-channel', 'a', 42);
    expect(send).toHaveBeenCalledWith('some-channel', 'a', 42);
  });

  it('does not send when the window is destroyed', () => {
    const send = vi.fn();
    const win = { isDestroyed: () => true, webContents: { send } };
    const sender = createSender(win as never);
    sender('some-channel', 'a');
    expect(send).not.toHaveBeenCalled();
  });
});
