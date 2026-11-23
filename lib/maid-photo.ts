/**
 * Maid photo resolution shared by the landing page, the search results, the
 * agency profile maid list and the maid profile page.
 *
 * A profile photo is either an absolute Supabase Storage URL
 * (`…/storage/v1/object/public/<bucket>/<key>`) or, for inventory imported from
 * the old ATS app, a legacy `/uploads/<key>` path. Those legacy files are not
 * part of this deployment (and imports can miss them), so a value is only used
 * when it can actually be fetched. Anything that is not an absolute http(s) URL
 * is skipped instead of rendering a broken image, and the UI falls back to the
 * maid's initials.
 */

export type MaidPhotoSource = {
  photoUrl?: string | null;
  photoUrls?: readonly string[] | null;
  photoThumbnailUrls?: readonly string[] | null;
  photoPortraitUrls?: readonly string[] | null;
};

function usableUrl(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  if (!trimmed) return null;
  // Legacy `/uploads/...` paths point at files that are not in this app.
  if (trimmed.startsWith("/")) return null;
  try {
    const url = new URL(trimmed);
    return url.protocol === "http:" || url.protocol === "https:"
      ? url.toString()
      : null;
  } catch {
    return null;
  }
}

/**
 * Best available photo URL, or `null` when the profile has no usable photo.
 * Portraits are preferred (they are pre-cropped), then the main photo, the
 * gallery and finally the thumbnails.
 */
export function maidPhotoUrl(maid: MaidPhotoSource): string | null {
  const candidates: (string | null | undefined)[] = [
    ...(maid.photoPortraitUrls ?? []),
    maid.photoUrl,
    ...(maid.photoUrls ?? []),
    ...(maid.photoThumbnailUrls ?? []),
  ];
  for (const candidate of candidates) {
    const url = usableUrl(candidate);
    if (url) return url;
  }
  return null;
}

/**
 * Initials for the photo placeholder: "Anna Valdez" → "AV".
 *
 * Rows that only have a reference ("Maid SG-1042") use that code instead of a
 * bare "M", so a card without a photo still says who it is.
 */
export function maidInitials(name: string): string {
  const words = name
    .trim()
    .split(/[\s,]+/)
    .map((word) => word.replace(/[^a-z0-9]/gi, ""))
    .filter((word) => /[a-z]/i.test(word));
  if (words.length === 0) return "M";
  const meaningful =
    words[0].toLowerCase() === "maid" && words.length > 1
      ? words.slice(1)
      : words;
  if (meaningful.length === 1) return meaningful[0].slice(0, 2).toUpperCase();
  return `${meaningful[0][0]}${meaningful[meaningful.length - 1][0]}`.toUpperCase();
}
