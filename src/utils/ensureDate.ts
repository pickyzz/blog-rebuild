// Lightweight helper to coerce various inputs into a Date instance when possible.
export function ensureDate(value: unknown): Date | undefined {
  if (value === undefined || value === null) return undefined;
  if (value instanceof Date) {
    return isNaN(value.getTime()) ? undefined : value;
  }
  try {
    const d = new Date(String(value));
    return isNaN(d.getTime()) ? undefined : d;
  } catch (e) {
    return undefined;
  }
}

export default ensureDate;
