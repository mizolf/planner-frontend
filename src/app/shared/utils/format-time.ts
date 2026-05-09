const HH_MM_PATTERN = /^(\d{2}):(\d{2})(?::\d{2})?$/;

export function formatTime(value: string | null | undefined): string {
  if (!value) {
    return "";
  }
  const match = HH_MM_PATTERN.exec(value);
  if (!match) {
    return value;
  }
  return `${match[1]}:${match[2]}`;
}

export function toBackendTime(
  value: string | null | undefined,
): string | undefined {
  if (!value) return undefined;
  const match = HH_MM_PATTERN.exec(value);
  if (!match) return undefined;
  return `${match[1]}:${match[2]}:00`;
}
