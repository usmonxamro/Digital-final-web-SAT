import { useCallback, useRef } from 'react'

/**
 * A function whose identity never changes but which always calls the latest closure.
 * Lets the exam timer re-render the engine every second without re-rendering the (memoised)
 * question view, option cards and KaTeX formulas that receive these callbacks.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function useStableCallback<T extends (...args: any[]) => any>(fn: T): T {
  const ref = useRef(fn)
  ref.current = fn
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useCallback(((...args: Parameters<T>) => ref.current(...args)) as T, [])
}
