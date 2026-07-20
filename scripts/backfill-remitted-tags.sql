-- Bulk-insert "Remitted" tags for daily-summary reports, one per date from
-- 2026-03-05 to 2026-07-05 (inclusive), except the excluded dates below.
-- This marks that range as already remitted so the Financial Standing
-- report's "Unremitted Net Sales" breakdown doesn't flag it.
--
-- Safe to re-run: skips any date already tagged "Remitted" for the same
-- user, so it won't create duplicates.

DO $$
DECLARE
  -- Resolve by email so you don't have to look up the UUID manually.
  -- If this returns NULL, replace with the literal UUID instead:
  --   v_user_id uuid := '00000000-0000-0000-0000-000000000000';
  v_user_id uuid := (SELECT id FROM auth.users WHERE email = 'villamor.renan@gmail.com');
  v_start_date date := '2026-03-05';
  v_end_date date := '2026-07-05';
  v_excluded_dates date[] := ARRAY['2026-05-24', '2026-06-19', '2026-06-20', '2026-06-21']::date[];
  v_inserted int;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'No auth user found for that email — set v_user_id manually.';
  END IF;

  INSERT INTO tag (reference, tag_name, tag_type, user_id)
  SELECT d::date::text, 'Remitted', 'daily-summary', v_user_id
  FROM generate_series(v_start_date, v_end_date, interval '1 day') AS d
  WHERE d::date <> ALL (v_excluded_dates)
    AND NOT EXISTS (
      SELECT 1
      FROM tag t
      WHERE t.reference = d::date::text
        AND t.tag_type = 'daily-summary'
        AND t.user_id = v_user_id
        AND lower(t.tag_name) = 'remitted'
    );

  GET DIAGNOSTICS v_inserted = ROW_COUNT;
  RAISE NOTICE 'Inserted % Remitted tag(s) for %..% (excluding %)', v_inserted, v_start_date, v_end_date, v_excluded_dates;
END $$;
