/**
 * @fileoverview Type definitions for IPC communication.
 * Defines the type-safe main-to-renderer message sender signature used by
 * every IPC handler module in the main process. The sender is created once in
 * src/main/ipc/handlers.ts via createSender() and shared with each handler
 * that needs to push asynchronous notifications (conversion progress, decoded
 * player frames, queue job updates) to the renderer.
 */

/**
 * Type-safe function for sending IPC messages from the main process to the
 * renderer process.
 *
 * The sender abstracts the underlying Electron BrowserWindow: it guards
 * against sending on a destroyed window and forwards a channel name plus a
 * variable-length argument list to the window's WebContents. It is the single,
 * type-checked path used by IPC handlers to emit main→renderer notifications
 * such as conversion progress, decoded player frames, and queue job events.
 *
 * @typedef {Function} IpcSender
 * @param {string} channel - The IPC channel name to send on. Callers should
 *   use the channel constants from src/shared/ipc-channels.ts (e.g.
 *   IPC.CONVERSION_PROGRESS, IPC.PLAYER_FRAME, IPC.QUEUE_ADDED).
 * @param {unknown[]} args - Optional payload arguments serialized to the
 *   renderer. Values must be structured-cloneable: primitives, plain
 *   objects/arrays, ArrayBuffers, Buffers (transferred as ArrayBuffer), etc.
 * @returns {void} Nothing is returned.
 */
export type IpcSender = (channel: string, ...args: unknown[]) => void;
