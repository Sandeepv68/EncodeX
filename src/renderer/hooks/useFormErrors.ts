/**
 * @fileoverview Hook for form-level error validation and display.
 * Manages validation errors for form fields.
 *
 * Holds a `Record<field, message>` map and exposes setter/clear helpers that
 * avoid redundant state updates (no-op when the value is unchanged). Used by
 * pages with user-editable fields (e.g. VideoCut and ImageCompress) to attach
 * per-field error messages to TextField components.
 */

import { useCallback, useState } from 'react';

/**
 * React hook managing per-field validation error messages for a form.
 *
 * @returns {Object} An object with the error map and its mutators:
 * @property {Record<string, string>} errors - Field name to error message map.
 * @property {(errors: Record<string, string>) => void} setErrors - Replaces the
 *   whole error map (bound to useState).
 * @property {(field: string) => void} clearFieldError - Removes a single field's
 *   error; a no-op when the field has no error.
 * @property {(field: string, message: string) => void} setFieldError - Sets a
 *   field's error message; a no-op when the message is unchanged.
 */
export function useFormErrors() {
  const [errors, setErrors] = useState<Record<string, string>>({});

  /**
   * Removes the error message for a single field.
   * Returns the previous state unchanged when the field has no error, avoiding
   * a re-render.
   * @param {string} field - The field whose error should be cleared.
   * @returns {void}
   */
  const clearFieldError = useCallback((field: string) => {
    setErrors((prev) => {
      if (!prev[field]) return prev;
      const next = { ...prev };
      delete next[field];
      return next;
    });
  }, []);

  /**
   * Sets the error message for a single field.
   * Returns the previous state unchanged when the message is identical,
   * avoiding a re-render.
   * @param {string} field - The field to mark as invalid.
   * @param {string} message - The error message to display for the field.
   * @returns {void}
   */
  const setFieldError = useCallback((field: string, message: string) => {
    setErrors((prev) => {
      if (prev[field] === message) return prev;
      return { ...prev, [field]: message };
    });
  }, []);

  return { errors, setErrors, clearFieldError, setFieldError };
}
