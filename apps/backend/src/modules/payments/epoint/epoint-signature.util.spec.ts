import {
  decodeData,
  encodeData,
  generateSignature,
  signPayload,
  verifySignature,
} from './epoint-signature.util';

describe('ePoint signature', () => {
  // ── GOLDEN VECTOR ──────────────────────────────────────────────
  // Copied verbatim from the official docs (developer.epoint.az/en/authentication).
  // If these assertions pass, our signing is byte-for-byte identical to ePoint's,
  // so genuine requests authenticate and genuine callbacks verify.
  const PRIVATE_KEY = 'd3hjsl38sd8kdfhbcea0be04eafde9e8e2bad2fb092d';
  const PAYLOAD = {
    public_key: 'i000000001',
    amount: '30.75',
    currency: 'AZN',
    description: 'test payment',
    order_id: '1',
  };
  const EXPECTED_DATA =
    'eyJwdWJsaWNfa2V5IjoiaTAwMDAwMDAwMSIsImFtb3VudCI6IjMwLjc1IiwiY3VycmVuY3kiOiJBWk4iLCJkZXNjcmlwdGlvbiI6InRlc3QgcGF5bWVudCIsIm9yZGVyX2lkIjoiMSJ9';
  const EXPECTED_SIG = 'a76GNudqblZtV8qF199hctA+cG0=';

  describe('golden vector (official ePoint example)', () => {
    it('encodeData reproduces the official base64 data', () => {
      expect(encodeData(PAYLOAD)).toBe(EXPECTED_DATA);
    });

    it('generateSignature reproduces the official signature', () => {
      expect(generateSignature(EXPECTED_DATA, PRIVATE_KEY)).toBe(EXPECTED_SIG);
    });

    it('signPayload yields the official data + signature together', () => {
      expect(signPayload(PAYLOAD, PRIVATE_KEY)).toEqual({
        data: EXPECTED_DATA,
        signature: EXPECTED_SIG,
      });
    });
  });

  describe('verifySignature', () => {
    it('accepts a genuine signature', () => {
      expect(verifySignature(EXPECTED_DATA, EXPECTED_SIG, PRIVATE_KEY)).toBe(true);
    });

    it('rejects a tampered signature', () => {
      const tampered = `${EXPECTED_SIG.slice(0, -2)}X=`;
      expect(verifySignature(EXPECTED_DATA, tampered, PRIVATE_KEY)).toBe(false);
    });

    it('rejects tampered data (e.g. amount inflated)', () => {
      const forgedData = encodeData({ ...PAYLOAD, amount: '3075.00' });
      expect(verifySignature(forgedData, EXPECTED_SIG, PRIVATE_KEY)).toBe(false);
    });

    it('rejects the wrong private key', () => {
      expect(verifySignature(EXPECTED_DATA, EXPECTED_SIG, 'not-our-key')).toBe(false);
    });

    it('rejects empty / short / malformed signatures without throwing', () => {
      expect(verifySignature(EXPECTED_DATA, '', PRIVATE_KEY)).toBe(false);
      expect(verifySignature(EXPECTED_DATA, 'short', PRIVATE_KEY)).toBe(false);
      // @ts-expect-error — exercising a runtime guard against a null signature
      expect(verifySignature(EXPECTED_DATA, null, PRIVATE_KEY)).toBe(false);
    });
  });

  describe('decodeData', () => {
    it('round-trips a callback payload', () => {
      const callback = {
        status: 'success',
        order_id: 'ORDER-1',
        transaction: 'te_0000000001',
        amount: '5.00',
        card_mask: '411111******1111',
      };
      expect(decodeData(encodeData(callback))).toEqual(callback);
    });

    it('decodes the official golden data back to the original payload', () => {
      expect(decodeData(EXPECTED_DATA)).toEqual(PAYLOAD);
    });
  });
});
