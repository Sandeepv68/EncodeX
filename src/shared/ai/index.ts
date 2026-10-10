/**
 * @fileoverview Public barrel for the EncodeX AI layer.
 *
 * Consumers (the MCP server, tests, later the desktop copilot) import from here
 * so the internal file layout can change without churn. Everything exported is
 * Electron-free and side-effect-free.
 */

export * from './types';
export * from './units';
export * from './media-facts';
export * from './analyze';
export * from './estimate';
export * from './validate';
export * from './recommend';
export * from './provider';
