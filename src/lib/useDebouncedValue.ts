import { useState, useEffect } from 'react';

/**
 * Returns a debounced copy of `value` that updates `delay` ms after
 * `value` stops changing. Defaults to a 250ms delay.
 */
export function useDebouncedValue<T>(value: T, delay: number = 250): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), delay);
    return () => window.clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}
