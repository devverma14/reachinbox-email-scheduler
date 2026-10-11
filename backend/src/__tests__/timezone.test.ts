import { describe, it, expect } from '@jest/globals';
import { parseKolkataLocalToUTC, formatInKolkataISO, formatKolkataDisplay } from '../lib/timezone';

describe('Asia/Kolkata Timezone Conversion Tests', () => {
  it('should parse local date/time "2026-10-10 22:46" in Asia/Kolkata (IST, UTC+05:30) to exact UTC ISO string', () => {
    const localInput = '2026-10-10 22:46';
    const parsedDate = parseKolkataLocalToUTC(localInput);

    // 2026-10-10 22:46:00 IST is 2026-10-10T17:16:00.000Z UTC
    expect(parsedDate.toISOString()).toBe('2026-10-10T17:16:00.000Z');
  });

  it('should parse local ISO format "2026-10-10T22:46" in Asia/Kolkata to UTC ISO string', () => {
    const localInput = '2026-10-10T22:46';
    const parsedDate = parseKolkataLocalToUTC(localInput);

    expect(parsedDate.toISOString()).toBe('2026-10-10T17:16:00.000Z');
  });

  it('should preserve full ISO strings with timezone offsets without double conversion', () => {
    const isoWithOffset = '2026-10-10T22:46:00+05:30';
    const parsedDate = parseKolkataLocalToUTC(isoWithOffset);

    expect(parsedDate.toISOString()).toBe('2026-10-10T17:16:00.000Z');

    const utcIso = '2026-10-10T17:16:00.000Z';
    expect(parseKolkataLocalToUTC(utcIso).toISOString()).toBe(utcIso);
  });

  it('should format UTC Date into YYYY-MM-DDTHH:mm string in Asia/Kolkata timezone', () => {
    const utcDate = new Date('2026-10-10T17:16:00.000Z');
    const kolkataISO = formatInKolkataISO(utcDate);

    expect(kolkataISO).toBe('2026-10-10T22:46');
  });

  it('should format UTC Date into readable display string in Asia/Kolkata timezone', () => {
    const utcDate = new Date('2026-10-10T17:16:00.000Z');
    const displayStr = formatKolkataDisplay(utcDate);

    expect(displayStr).toContain('Oct 10, 2026');
    expect(displayStr).toContain('10:46 PM');
  });
});
