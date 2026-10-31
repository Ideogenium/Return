import { useCallback, useEffect, useRef, useState } from 'react';
import { extractProblemDetails } from '../utils/error';
import type { ProblemDetails } from '../types/api.types';

/**
 * Loads the entity of a detail screen and exposes the error of THIS screen's own
 * request for THIS id — never an error left in the shared store by another screen.
 * The screen decides how to show it: full screen when nothing is displayable yet,
 * non-blocking (RefreshError) when the entity is already on screen.
 */
export function useEntityLoad(
  id: string,
  load: (id: string) => Promise<unknown>,
): { loadError: ProblemDetails | null; reload: () => Promise<void> } {
  const [loadError, setLoadError] = useState<ProblemDetails | null>(null);
  const latestRequest = useRef(0);

  const reload = useCallback(async () => {
    const request = ++latestRequest.current;
    setLoadError(null);
    try {
      await load(id);
    } catch (err) {
      // A late answer for a previous id must not overwrite the current state.
      if (request === latestRequest.current) setLoadError(extractProblemDetails(err));
    }
  }, [id, load]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { loadError, reload };
}
