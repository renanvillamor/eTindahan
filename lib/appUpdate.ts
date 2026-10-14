import Constants from "expo-constants";

// Releases are published to this (public) repo's GitHub Releases, each with
// an `eTindahan.apk` asset — see "Release process" in docs/APP_NOTES.md.
const GITHUB_REPO = "renanvillamor/eTindahan";
const RELEASE_APK_NAME = "eTindahan.apk";

export type LatestRelease = {
  version: string;
  name: string;
  notes: string;
  apkUrl: string | null;
  pageUrl: string;
};

export type UpdateCheckResult = {
  currentVersion: string;
  latest: LatestRelease;
  isUpdateAvailable: boolean;
};

/** Installed app version, from app.json `expo.version` baked into the build. */
export function getCurrentAppVersion(): string {
  return Constants.expoConfig?.version ?? "0.0.0";
}

/** Strips a leading "v" and anything after a "-"/"+" (pre-release/build). */
function parseVersion(version: string): number[] {
  return version
    .trim()
    .replace(/^v/i, "")
    .split(/[-+]/)[0]
    .split(".")
    .map((part) => Number.parseInt(part, 10) || 0);
}

/** > 0 if a is newer than b, < 0 if older, 0 if equal. */
export function compareVersions(a: string, b: string): number {
  const pa = parseVersion(a);
  const pb = parseVersion(b);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const diff = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

export async function checkForAppUpdate(): Promise<UpdateCheckResult> {
  const response = await fetch(
    `https://api.github.com/repos/${GITHUB_REPO}/releases/latest`,
    { headers: { Accept: "application/vnd.github+json" } },
  );
  if (response.status === 404) {
    throw new Error("No published release found.");
  }
  if (!response.ok) {
    throw new Error(`Update check failed (HTTP ${response.status}).`);
  }

  const release = await response.json();
  const apkAsset = (release.assets ?? []).find(
    (asset: any) => asset?.name === RELEASE_APK_NAME,
  );
  const latest: LatestRelease = {
    version: String(release.tag_name ?? "").replace(/^v/i, ""),
    name: release.name || release.tag_name || "",
    notes: release.body ?? "",
    apkUrl: apkAsset?.browser_download_url ?? null,
    pageUrl: release.html_url,
  };

  const currentVersion = getCurrentAppVersion();
  return {
    currentVersion,
    latest,
    isUpdateAvailable: compareVersions(latest.version, currentVersion) > 0,
  };
}
