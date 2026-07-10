import { useState, useEffect } from 'react';

/**
 * Returns a debounced version of the value that only updates after `delay` ms
 * of silence. The timer resets on every value change.
 */
export function useDebounce<T>(value: T, delay: number = 300): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const id = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);

  return debouncedValue;
}
