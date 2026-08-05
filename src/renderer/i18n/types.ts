/**
 * @fileoverview Type definitions for internationalization.
 * Defines locale metadata and flag component types.
 */

import type { ComponentType, CSSProperties } from 'react';

/**
 * React component used to render a country flag.
 * @typedef {ComponentType<{ style?: CSSProperties }>} FlagComponent
 */
export type FlagComponent = ComponentType<{ style?: CSSProperties }>;

/**
 * Metadata describing a supported locale.
 * @interface LocaleMeta
 */
export interface LocaleMeta {
  code: string;
  label: string;
  Flag: FlagComponent;
}
