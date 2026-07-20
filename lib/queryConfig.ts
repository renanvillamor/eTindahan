// Shared staleness window for report/reference reads that are triggered on
// screen mount. Without this, react-query's global default (staleTime: 0)
// forces a fresh network round-trip to Supabase every single time a screen
// is revisited, even seconds later — that's the dominant cause of perceived
// "delay when navigating". Mutations that must reflect instantly (deliveries,
// inventory counts, tags) already call queryClient.invalidateQueries() on
// success, so this window only affects casual back-and-forth navigation.
export const DEFAULT_STALE_TIME = 30_000;
