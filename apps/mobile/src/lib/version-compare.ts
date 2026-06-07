/**
 * Mirror of apps/backend/src/modules/super-admin/version/version-compare.ts.
 *
 * Mobile + backend MUST use identical comparison semantics — backend
 * accepts and stores "MAJOR.MINOR.PATCH"; mobile compares its bundled
 * version against the server's minimumVersion to decide if a force
 * update is required.
 *
 * Backend has 6 unit tests covering this. We do not duplicate them
 * here; if the two implementations drift, the failure surfaces in the
 * version-check integration test.
 */

const VERSION_PATTERN = /^\d+\.\d+\.\d+$/;

/** Returns < 0 if a < b, 0 if equal, > 0 if a > b. Throws on malformed input. */
export function compareVersions(a: string, b: string): number {
  const pa = parse(a);
  const pb = parse(b);
  if (pa.major !== pb.major) return pa.major - pb.major;
  if (pa.minor !== pb.minor) return pa.minor - pb.minor;
  return pa.patch - pb.patch;
}

function parse(v: string): { major: number; minor: number; patch: number } {
  if (!VERSION_PATTERN.test(v)) {
    throw new Error(`Invalid version "${v}". Expected "MAJOR.MINOR.PATCH" (e.g. "1.2.3").`);
  }
  const [major, minor, patch] = v.split('.').map(Number) as [number, number, number];
  return { major, minor, patch };
}
