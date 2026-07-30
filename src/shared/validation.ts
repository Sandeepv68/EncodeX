export function isValidTime(value: string): boolean {
  if (!value.trim()) return false;
  if (/^\d+(\.\d+)?$/.test(value)) return parseFloat(value) >= 0;
  return /^\d{1,2}:\d{2}:\d{2}(\.\d+)?$/.test(value);
}

export function isValidScale(value: string): boolean {
  if (!value.trim()) return false;
  if (/^\d{1,3}%$/.test(value)) {
    const pct = parseInt(value);
    return pct >= 1 && pct <= 999;
  }
  if (/^-?\d+(\.\d+)?[:x]-?\d+(\.\d+)?$/.test(value)) return true;
  if (/^-?\d+(\.\d+)?$/.test(value)) return parseInt(value) > 0;
  return false;
}

export function isValidBitrate(value: string): boolean {
  if (!value.trim()) return false;
  return /^\d+[KkMm]?$/.test(value);
}

export function isInRange(value: number, min: number, max: number): boolean {
  return Number.isFinite(value) && value >= min && value <= max;
}
