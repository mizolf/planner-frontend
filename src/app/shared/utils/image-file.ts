export const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

/**
 * Client-side pre-check before uploading a trip cover image (UX only — the
 * backend re-validates the actual file content). Returns a translation key
 * describing the problem, or null when the file is acceptable.
 */
export function validateImageFile(file: File): string | null {
  if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
    return 'TRIPS.DETAIL.IMAGE.ERRORS.INVALID_TYPE';
  }
  if (file.size > MAX_IMAGE_BYTES) {
    return 'TRIPS.DETAIL.IMAGE.ERRORS.TOO_LARGE';
  }
  return null;
}
