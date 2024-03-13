import { type DependencyList, useCallback, useRef } from "react";

export default function useDebounceCallback<
  T extends (...args: never[]) => ReturnType<T>,
>(func: T, dependencies?: DependencyList, delay = 300) {
  const timer = useRef<NodeJS.Timeout | null>(null);

  return useCallback((...args: Parameters<T>) => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
        timer.current = null;
        func(...args);
    }, delay)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },  [...dependencies ?? [], delay, func]);
}
