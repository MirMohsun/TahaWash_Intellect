import { VERSION_PATTERN, compareVersions } from './version-compare';

describe('compareVersions', () => {
  it('returns 0 when equal', () => {
    expect(compareVersions('1.0.0', '1.0.0')).toBe(0);
    expect(compareVersions('2.5.7', '2.5.7')).toBe(0);
  });

  it('returns negative when a < b', () => {
    expect(compareVersions('1.0.0', '1.0.1')).toBeLessThan(0);
    expect(compareVersions('1.0.9', '1.1.0')).toBeLessThan(0);
    expect(compareVersions('1.9.9', '2.0.0')).toBeLessThan(0);
  });

  it('returns positive when a > b', () => {
    expect(compareVersions('1.0.1', '1.0.0')).toBeGreaterThan(0);
    expect(compareVersions('2.0.0', '1.99.99')).toBeGreaterThan(0);
  });

  it('handles double-digit components correctly (string sort would fail here)', () => {
    expect(compareVersions('1.10.0', '1.9.0')).toBeGreaterThan(0);
    expect(compareVersions('1.2.10', '1.2.9')).toBeGreaterThan(0);
  });

  it('throws for malformed versions', () => {
    expect(() => compareVersions('1.0', '1.0.0')).toThrow();
    expect(() => compareVersions('1.0.0', 'v1.0.0')).toThrow();
    expect(() => compareVersions('1.0.0-beta', '1.0.0')).toThrow();
    expect(() => compareVersions('1.a.0', '1.0.0')).toThrow();
  });

  it('VERSION_PATTERN matches valid + rejects invalid', () => {
    expect(VERSION_PATTERN.test('1.2.3')).toBe(true);
    expect(VERSION_PATTERN.test('0.0.0')).toBe(true);
    expect(VERSION_PATTERN.test('10.20.30')).toBe(true);
    expect(VERSION_PATTERN.test('1.2')).toBe(false);
    expect(VERSION_PATTERN.test('1.2.3.4')).toBe(false);
    expect(VERSION_PATTERN.test('1.2.3-rc1')).toBe(false);
    expect(VERSION_PATTERN.test('')).toBe(false);
  });
});
