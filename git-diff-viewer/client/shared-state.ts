import { useCallback, useSyncExternalStore } from "react";

export type SharedPanelState = {
  selected: string;
  extraRoots: string[];
  tab: "changes" | "history";
};

// The client bundle is evaluated once per host, so this module state is shared by every
// instance of the panel in the app. Instances of the same workspace therefore stay in sync.
const states = new Map<string, SharedPanelState>();
const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) listener();
}

export function useSharedPanelState(key: string, fallback: SharedPanelState) {
  const subscribe = useCallback((listener: () => void) => {
    listeners.add(listener);
    return () => { listeners.delete(listener); };
  }, []);
  const getSnapshot = useCallback(() => states.get(key), [key]);
  const shared = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  const write = useCallback((next: SharedPanelState) => {
    states.set(key, next);
    emit();
  }, [key]);
  return { shared: shared ?? fallback, write };
}
