/**
 * ReachInbox Timezone Utilities (Frontend)
 * Primary Timezone: Asia/Kolkata (IST, UTC+05:30)
 */

export const INTENDED_TIMEZONE = 'Asia/Kolkata';

/**
 * Formats a Date object into YYYY-MM-DDTHH:mm string in Asia/Kolkata timezone
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
 * Parses a local date/time string (e.g. "2026-10-10 22:46" or "2026-10-10T22:46")
 * in Asia/Kolkata timezone into an exact UTC ISO 8601 string.
 */
export function parseKolkataLocalToISO(localDateTimeStr: string): string {
  if (!localDateTimeStr) return new Date().toISOString();

  // If already contains ISO offset (Z or +HH:mm or -HH:mm), return as ISO
  if (/[Z+-]\d{2}/.test(localDateTimeStr) || localDateTimeStr.endsWith('Z')) {
    return new Date(localDateTimeStr).toISOString();
  }

  let formatted = localDateTimeStr.trim().replace(' ', 'T');
  if (formatted.length === 16) {
    formatted += ':00';
  }

  const kolkataISO = `${formatted}+05:30`;
  const date = new Date(kolkataISO);

  if (isNaN(date.getTime())) {
    return new Date().toISOString();
  }

  return date.toISOString();
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
