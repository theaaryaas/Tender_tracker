/**
 * Unified Date and Deadline Utilities for BitVivid Tender Tracking
 */

const MONTH_NAMES = {
  jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
  jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11
};

/**
 * Robustly parses tender closing date strings into a JavaScript Date object.
 * Handles formats like:
 * - "02-Nov-2026 03:00 PM"
 * - "01 Dec 2026 04:30 PM"
 * - "01-Dec-2026 12:30 AM"
 * - "2026-11-02 15:00:00"
 * - "02/11/2026 15:00"
 */
export const parseTenderDate = (dateStr) => {
  if (!dateStr || typeof dateStr !== 'string') return null;
  const s = dateStr.trim();
  if (!s || s.toLowerCase().startsWith('check') || s.toLowerCase().startsWith('not shown')) {
    return null;
  }

  // Check for "DD-MMM-YYYY HH:MM AM/PM" or "DD MMM YYYY HH:MM AM/PM"
  const dmyMatch = s.match(
    /^(\d{1,2})[-/ ]([A-Za-z]{3,9}|\d{1,2})[-/ ](\d{4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?(?:\s*(AM|PM|am|pm))?)?/
  );

  if (dmyMatch) {
    const day = parseInt(dmyMatch[1], 10);
    const monthRaw = dmyMatch[2].toLowerCase().slice(0, 3);
    const year = parseInt(dmyMatch[3], 10);

    let month = MONTH_NAMES[monthRaw];
    if (month === undefined) {
      month = parseInt(dmyMatch[2], 10) - 1;
    }

    let hours = dmyMatch[4] ? parseInt(dmyMatch[4], 10) : 0;
    const minutes = dmyMatch[5] ? parseInt(dmyMatch[5], 10) : 0;
    const seconds = dmyMatch[6] ? parseInt(dmyMatch[6], 10) : 0;
    const meridian = dmyMatch[7]?.toUpperCase();

    if (meridian === 'PM' && hours < 12) hours += 12;
    if (meridian === 'AM' && hours === 12) hours = 0;

    const d = new Date(year, month, day, hours, minutes, seconds);
    if (!isNaN(d.getTime())) return d;
  }

  // ISO string fallback (YYYY-MM-DD...)
  const isoDate = new Date(s.replace(' ', 'T'));
  if (!isNaN(isoDate.getTime())) return isoDate;

  const fallback = new Date(s.replace(/-/g, ' '));
  return isNaN(fallback.getTime()) ? null : fallback;
};

/**
 * Returns formatted date and time parts, countdown remaining, and urgency level.
 */
export const formatDeadline = (rawDate) => {
  const parsed = parseTenderDate(rawDate);
  if (!parsed) {
    return {
      date: rawDate || 'Open',
      time: 'Active',
      countdown: 'No Deadline',
      urgency: 'none',
      diffHours: Infinity,
      isExpired: false
    };
  }

  const now = new Date();
  const diffMs = parsed.getTime() - now.getTime();
  const diffSeconds = Math.floor(diffMs / 1000);
  const diffHours = diffSeconds / 3600;
  const isExpired = diffSeconds < 0;

  let countdown = '';
  let urgency = 'normal';

  if (isExpired) {
    countdown = 'Expired';
    urgency = 'expired';
  } else if (diffSeconds < 3600) {
    const mins = Math.max(1, Math.floor(diffSeconds / 60));
    countdown = `${mins}m left`;
    urgency = 'critical';
  } else if (diffSeconds < 86400) {
    const hours = Math.floor(diffSeconds / 3600);
    const mins = Math.floor((diffSeconds % 3600) / 60);
    countdown = `${hours}h ${mins}m left`;
    urgency = 'critical';
  } else if (diffSeconds < 172800) {
    const hours = Math.floor((diffSeconds - 86400) / 3600);
    countdown = `1d ${hours}h left`;
    urgency = 'urgent';
  } else if (diffSeconds < 7 * 86400) {
    const days = Math.floor(diffSeconds / 86400);
    countdown = `${days} days left`;
    urgency = 'upcoming';
  } else {
    const days = Math.floor(diffSeconds / 86400);
    countdown = `${days} days left`;
    urgency = 'standard';
  }

  // Format date: "02 Nov 2026"
  const dayStr = String(parsed.getDate()).padStart(2, '0');
  const monthStr = parsed.toLocaleString('en-US', { month: 'short' });
  const yearStr = parsed.getFullYear();
  const dateFormatted = `${dayStr} ${monthStr} ${yearStr}`;

  // Format time: "03:00 PM"
  const timeFormatted = parsed.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  });

  return {
    date: dateFormatted,
    time: timeFormatted,
    countdown,
    urgency,
    diffHours,
    diffSeconds,
    isExpired,
    timestamp: parsed.getTime()
  };
};

/**
 * Sorts tenders chronologically by closing deadline (nearest first).
 */
export const sortTendersByDeadline = (tenders, ascending = true) => {
  return [...tenders].sort((a, b) => {
    const dateA = parseTenderDate(a.closing_date);
    const dateB = parseTenderDate(b.closing_date);

    if (!dateA && !dateB) return 0;
    if (!dateA) return 1;
    if (!dateB) return -1;

    return ascending
      ? dateA.getTime() - dateB.getTime()
      : dateB.getTime() - dateA.getTime();
  });
};

