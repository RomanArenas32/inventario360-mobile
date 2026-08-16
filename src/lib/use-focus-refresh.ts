import { useRef, useCallback } from 'react';
import { useFocusEffect } from 'expo-router';
import { useQueryClient, type QueryKey } from '@tanstack/react-query';

/**
 * Invalidates queries on screen focus, but only if the cached data is older
 * than `staleMs`. Respects the global staleTime instead of bypassing it.
 *
 * Uses a ref so dynamic keys (e.g. ['turns', dateKey]) always resolve to the
 * latest value without needing to be in the useCallback dependency array.
 */
export function useFocusRefresh(keys: QueryKey[], staleMs = 30_000) {
  const queryClient = useQueryClient();
  const keysRef = useRef<QueryKey[]>(keys);
  keysRef.current = keys; // update synchronously on every render

  useFocusEffect(
    useCallback(() => {
      const now = Date.now();
      for (const key of keysRef.current) {
        const state = queryClient.getQueryState(key);
        const age = state?.dataUpdatedAt ? now - state.dataUpdatedAt : Infinity;
        if (age >= staleMs) {
          void queryClient.invalidateQueries({ queryKey: key });
        }
      }
    }, [queryClient, staleMs]),
  );
}
