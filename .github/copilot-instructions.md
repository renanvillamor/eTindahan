# Copilot Instructions

These are repo-wide rules for ALL Copilot Chat responses and code changes in this workspace.

## Non‑Negotiables

- MUST follow existing patterns and file structure; keep changes minimal and scoped.
- MUST prefer **React Native Paper** for common UI controls (buttons, icon buttons, inputs, lists, dialogs).
- MUST prefer **NativeWind** utility classes via `className` for layout/spacing/colors.
- MUST NOT introduce new inline `style={{...}}` objects for layout/spacing/colors.
- If `className` cannot be used (component doesn’t support it), use a component-level `StyleSheet.create(...)` (placed BELOW the component) with minimal overrides.
- MUST NOT hard-code new color tokens; use Paper theme (`useTheme` / app theme hook) and existing Tailwind utilities.

## UI Components (React Native Paper)

- Use Paper `Button`, `IconButton`, `TextInput`, `List`, `Searchbar`, `Dialog` instead of `TouchableOpacity` + `Text` unless a custom control is required.
- Prefer Paper props/theming first; add `className` only where supported.
- Keep Paper-specific style overrides minimal.

## Styling (NativeWind)

- Prefer NativeWind `className` utilities for spacing/layout/background/text.
- Avoid adding new inline `style={{...}}`.
- If a numeric/dynamic value cannot be expressed via utilities, use a `StyleSheet` object (not inline style).

## Date & Time Handling

- MUST always save datetime values to the database as **UTC** using `new Date().toISOString()` (which produces a UTC ISO 8601 string).
- MUST always **display** datetime values in the user's **local timezone** by parsing with `date-fns` (`parseISO`, `format`, etc.). Never display raw UTC strings directly.
- When parsing timestamps returned from Supabase (which may lack a timezone suffix), treat them as UTC by appending `'Z'` before parsing if no offset is present:
  ```ts
  let iso = ts.replace(" ", "T");
  if (!iso.endsWith("Z") && !/[+-]\d{2}:\d{2}$/.test(iso)) iso += "Z";
  const dt = parseISO(iso);
  ```
- Use `date-fns` exclusively for all date formatting and arithmetic (`format`, `parseISO`, `isValid`, `startOfDay`, `endOfDay`, `addDays`, etc.). Do not use raw `Date` methods for display.
- When filtering records by a local calendar day, convert the local day boundaries to UTC ISO strings before passing to Supabase range filters (`.gte` / `.lte`).

## When Unsure

- If a requirement is ambiguous, ask 1–2 clarifying questions before implementing.
- If you violate any rule above, immediately revise the patch to comply.

## Styling (NativeWind)

- When applying or changing UI styling in this repo, prefer **NativeWind** utility classes via `className`.
- Avoid adding new inline `style={{...}}` objects for layout/spacing/colors; use NativeWind classes instead.
- If NativeWind classes are not applicable (e.g., on third-party components that don't support `className`), use a component-level style object (e.g., `StyleSheet.create`) instead of inline `style={{...}}`.
- Only use inline styles when a value cannot be expressed reasonably with existing NativeWind/Tailwind utilities (e.g., truly dynamic computed values). In those cases, keep inline styles minimal and do not hard-code new color tokens.
- Place any component-level style objects (e.g., `StyleSheet.create` or style objects) below the component declaration, not at the top of the file or component.

## UI Components (React Native Paper)

- Prefer using **React Native Paper** components for common UI controls (buttons, icon buttons, inputs, lists, dialogs) to keep a consistent, accessible design and to leverage Paper's theming.
- When using Paper components, prefer Paper props and theming for spacing and colors; apply NativeWind `className` utilities where the Paper component supports it, and use a component-level `StyleSheet` for sizing or platform-specific tweaks when needed.
- Use Paper's `IconButton`, `Button`, `TextInput`, and `List` components instead of hand-rolled `TouchableOpacity` + `Text` combinations unless a custom control is required.
- Keep Paper-specific style overrides minimal; prefer theme tokens and utility classes for consistent look-and-feel.
