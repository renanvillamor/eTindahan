import { createClient } from "@supabase/supabase-js";
import Constants from "expo-constants";

const extras =
  (Constants.expoConfig && (Constants.expoConfig as any).extra) ||
  (Constants.manifest && (Constants.manifest as any).extra) ||
  {};

const SUPABASE_URL =
  (extras && extras.EXPO_PUBLIC_SUPABASE_URL) ||
  process.env.EXPO_PUBLIC_SUPABASE_URL ||
  "";

const SUPABASE_PUBLISHABLE_KEY =
  (extras && extras.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY) ||
  process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
  "";

if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
  console.warn(
    "Supabase URL or publishable key is not set. Configure EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY in app.json (expo.extra) or environment variables."
  );
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);
