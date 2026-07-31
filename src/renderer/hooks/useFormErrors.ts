import { useCallback, useState } from 'react';

export function useFormErrors() {
  const [errors, setErrors] = useState<Record<string, string>>({});

  const clearFieldError = useCallback((field: string) => {
    setErrors((prev) => {
      if (!prev[field]) return prev;
      const next = { ...prev };
      delete next[field];
      return next;
    });
  }, []);

  const setFieldError = useCallback((field: string, message: string) => {
    setErrors((prev) => {
      if (prev[field] === message) return prev;
      return { ...prev, [field]: message };
    });
  }, []);

  return { errors, setErrors, clearFieldError, setFieldError };
}
