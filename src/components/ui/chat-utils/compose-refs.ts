import * as React from "react";

type PossibleRef<T> = React.Ref<T> | undefined;

function assignRef<T>(ref: PossibleRef<T>, value: T) {
  if (typeof ref === "function") {
    return ref(value);
  }
  if (ref !== null && ref !== undefined) {
    (ref as React.MutableRefObject<T>).current = value;
  }
}

/**
 * Combines multiple callback or object refs into a single React ref callback.
 */
export function composeRefs<T>(...refs: PossibleRef<T>[]): React.RefCallback<T> {
  return (node) => {
    const cleanups: (() => void)[] = [];
    for (const ref of refs) {
      const cleanup = assignRef(ref, node);
      if (typeof cleanup === "function") {
        cleanups.push(cleanup);
      }
    }
    if (cleanups.length > 0) {
      return () => {
        for (const cleanup of cleanups) {
          cleanup();
        }
      };
    }
  };
}

/**
 * Returns a memoized composed ref callback for up to six refs.
 */
export function useComposedRefs<T>(
  r0?: PossibleRef<T>,
  r1?: PossibleRef<T>,
  r2?: PossibleRef<T>,
  r3?: PossibleRef<T>,
  r4?: PossibleRef<T>,
  r5?: PossibleRef<T>,
): React.RefCallback<T> {
  return React.useCallback(
    (node: T) => composeRefs(r0, r1, r2, r3, r4, r5)(node),
    [r0, r1, r2, r3, r4, r5],
  );
}
