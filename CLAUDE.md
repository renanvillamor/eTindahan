# CLAUDE.md

Instructions for Claude Code when working in this repository.

## Source of truth: docs/APP_NOTES.md

**Read [docs/APP_NOTES.md](docs/APP_NOTES.md) before making any change that
touches business logic, calculations, or data flow** — inventory, pricing,
sales, deliveries, payables, expenses, or any report. It documents the
domain model (unit conventions, what each price/quantity field actually
means), architecture (state, caching, offline sync), the date/timezone
handling rules, report methodology, and a running log of known bugs (fixed
and still-open).

This matters because the unit model in particular is easy to get subtly
wrong in ways that don't show up as type errors: `Item.supplierPrice` is
per-pack, `Item.retailPrice`/`wholesalePrice` are per-unit,
`SaleToday.quantity` is in single units while `Inventory`/`Delivery`
quantities are in pack units. Silently mixing these up produces numbers
that look plausible but are wrong.

Treat `docs/APP_NOTES.md` as authoritative over guesses from reading
individual files in isolation — it was built from a full-codebase business
logic audit and captures cross-file invariants (e.g. three separate
services independently implement the same "on-hand quantity" formula and
are expected to agree) that aren't obvious from any single file.

**Keep it current.** When a change affects anything documented there
(the data model, a report's methodology, a caching/invalidation
relationship, a known issue gets fixed or a new one is found), update
`docs/APP_NOTES.md` in the same change — don't let it drift into being
wrong. A stale source of truth is worse than no source of truth.

## Coding style rules

Non-negotiable, repo-wide. Keep changes minimal and scoped to existing
patterns and file structure.

### UI components

- Prefer **React Native Paper** for common controls: `Button`, `IconButton`,
  `TextInput`, `List`, `Searchbar`, `Dialog`. Don't hand-roll
  `TouchableOpacity` + `Text` combinations unless a genuinely custom control
  is required.
- Prefer Paper's own props/theming for spacing and colors first; apply
  NativeWind `className` where the component supports it.
- Keep Paper-specific style overrides minimal — prefer theme tokens and
  utility classes over one-off overrides.

### Styling (NativeWind)

- Prefer NativeWind `className` utilities for layout/spacing/background/text.
- Do **not** introduce new inline `style={{...}}` objects for
  layout/spacing/colors.
- If `className` isn't supported by a component (e.g. some third-party
  components), use a component-level `StyleSheet.create(...)` instead of an
  inline style — and place it *below* the component declaration, not above
  or inside it.
- Only fall back to inline styles for values that genuinely can't be
  expressed with existing utilities (e.g. a truly dynamic computed value).
  Keep those minimal.
- Do not hard-code new color tokens — use the Paper theme (`useTheme` / the
  app's theme hook) and existing Tailwind utilities.

### Date & time handling

- Always save datetime values to the database as **UTC**, via
  `new Date().toISOString()`.
- Always **display** datetime values in the user's local timezone, via
  `date-fns` (`parseISO`, `format`, etc.) — never render a raw UTC string.
- Timestamps coming back from Supabase can lack a timezone suffix; treat
  them as UTC by appending `'Z'` before parsing if no offset is present:
  ```ts
  let iso = ts.replace(" ", "T");
  if (!iso.endsWith("Z") && !/[+-]\d{2}:\d{2}$/.test(iso)) iso += "Z";
  const dt = parseISO(iso);
  ```
- Use `date-fns` exclusively for date formatting/arithmetic (`format`,
  `parseISO`, `isValid`, `startOfDay`, `endOfDay`, `addDays`, etc.) — not
  raw `Date` methods — for display and comparisons.
- When **filtering** records by a local calendar day, convert the local day
  boundary to a UTC ISO string before passing it to a Supabase range filter
  (`.gte()` / `.lte()`). Use the helpers in `lib/utils.ts`
  (`localDayToUtcRange`, `localDayStartUtc`, `toLocalDateStr`) rather than
  comparing raw date strings — see the "Date/timezone handling" section of
  `docs/APP_NOTES.md` for why this matters and what broke before it was fixed.

### When unsure

If a requirement is ambiguous, ask 1–2 clarifying questions before
implementing. If you notice a change violates any rule above, revise it
immediately rather than leaving it.
