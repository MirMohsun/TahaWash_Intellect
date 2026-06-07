/**
 * Semantic-ish version comparator.
 *
 * Accepts "MAJOR.MINOR.PATCH" with each component a non-negative integer.
 * Anything else throws — we keep the format strict so the mobile force-
 * update logic can rely on it.
 *
 * Returns:
 *   < 0 if a is older than b
 *   0   if equal
 *   > 0 if a is newer than b
 */
export function compareVersions(a: string, b: string): number {
  const pa = parseVersion(a);
  const pb = parseVersion(b);
  if (pa.major !== pb.major) return pa.major - pb.major;
  if (pa.minor !== pb.minor) return pa.minor - pb.minor;
  return pa.patch - pb.patch;
}

export const VERSION_PATTERN = /^\d+\.\d+\.\d+$/;

interface ParsedVersion {
  major: number;
  minor: number;
  patch: number;
}

function parseVersion(v: string): ParsedVersion {
  if (!VERSION_PATTERN.test(v)) {
    throw new Error(`Invalid version "${v}". Expected "MAJOR.MINOR.PATCH" (e.g. "1.2.3").`);
  }
  const [major, minor, patch] = v.split('.').map(Number);
  return { major, minor, patch };
}
