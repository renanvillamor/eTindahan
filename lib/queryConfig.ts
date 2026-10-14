// Shared staleness window for report/reference reads that are triggered on
// screen mount. Without this, react-query's global default (staleTime: 0)
// forces a fresh network round-trip to Supabase every single time a screen
// is revisited, even seconds later — that's the dominant cause of perceived
// "delay when navigating". Mutations that must reflect instantly (deliveries,
// inventory counts, tags) already call queryClient.invalidateQueries() on
// success, so this window only affects casual back-and-forth navigation.
export const DEFAULT_STALE_TIME = 30_000;

// For data that only needs a background refresh once a day (e.g. recurring
// expense templates, checked passively on every Dashboard visit) — keeps
// normal navigation from re-hitting the API, while a mutation still
// invalidates and refetches immediately regardless of this window.
export const DAY_STALE_TIME = 24 * 60 * 60 * 1000;
