/**
 * ReachInbox Timezone Utilities
 * Configured Timezone: Asia/Kolkata (IST, UTC+05:30)
 */

export const INTENDED_TIMEZONE = 'Asia/Kolkata';

/**
 * Parses a local date/time string (e.g. "2026-10-10 22:46" or "2026-10-10T22:46")
 * interpreted in Asia/Kolkata timezone (UTC+05:30) into an exact UTC Date object.
 */
export function parseKolkataLocalToUTC(localDateTimeStr: string): Date {
  if (!localDateTimeStr) return new Date();

  // If already contains ISO offset (Z or +HH:mm or -HH:mm), parse natively
  if (/[Z+-]\d{2}/.test(localDateTimeStr) || localDateTimeStr.endsWith('Z')) {
    return new Date(localDateTimeStr);
  }

  // Normalize string format YYYY-MM-DDTHH:mm
  let formatted = localDateTimeStr.trim().replace(' ', 'T');
  if (formatted.length === 16) {
    formatted += ':00';
  }

  // Append IST offset (+05:30)
  const kolkataISO = `${formatted}+05:30`;
  const date = new Date(kolkataISO);

  if (isNaN(date.getTime())) {
    throw new Error(`Invalid date string: ${localDateTimeStr}`);
  }

  return date;
}

/**
 * Formats a Date object into YYYY-MM-DDTHH:mm format in Asia/Kolkata timezone
 * (suitable for HTML <input type="datetime-local">)
 */
export function formatInKolkataISO(dateInput: Date = new Date()): string {
  const date = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
  if (isNaN(date.getTime())) return '';

  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: INTENDED_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });

  const parts = formatter.formatToParts(date);
  const getPart = (type: string) => parts.find((p) => p.type === type)?.value || '00';

  let hour = getPart('hour');
  if (hour === '24') hour = '00';

  return `${getPart('year')}-${getPart('month')}-${getPart('day')}T${hour}:${getPart('minute')}`;
}

/**
 * Formats a Date object or ISO string into a human-readable string in Asia/Kolkata timezone
 */
export function formatKolkataDisplay(dateInput: Date | string): string {
  const date = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
  if (isNaN(date.getTime())) return String(dateInput);

  return date.toLocaleString('en-US', {
    timeZone: INTENDED_TIMEZONE,
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
}
