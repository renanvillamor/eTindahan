import { usePathname, useRouter } from "expo-router";
import { useCallback } from "react";

export default function useSafePush() {
  const router = useRouter();
  const pathname = usePathname();

  const normalize = (s: string | null | undefined) =>
    (s || "").replace(/\/+$/g, "");

  return useCallback(
    (to: string) => {
      const from = normalize(pathname);
      const dest = normalize(to);
      if (!dest) return;
      if (from === dest) return;
      router.push(to as any);
    },
    [pathname, router]
  );
}
