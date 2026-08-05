/**
 * @fileoverview Type definitions for IPC communication.
 * Defines the main-to-renderer message sender signature.
 */

/**
 * Type-safe function for sending IPC messages from main to renderer.
 * @typedef {Function} IpcSender
 */
export type IpcSender = (channel: string, ...args: unknown[]) => void;
