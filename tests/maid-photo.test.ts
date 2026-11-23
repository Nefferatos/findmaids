import { describe, expect, it } from "vitest";
import { maidInitials, maidPhotoUrl } from "@/lib/maid-photo";

const STORAGE =
  "https://tajpujqabclbxoggkxse.supabase.co/storage/v1/object/public/findmaids-media/5c63b490.webp";

describe("maid photo url", () => {
  it("uses the supabase storage url", () => {
    expect(maidPhotoUrl({ photoUrl: STORAGE })).toBe(STORAGE);
  });

  it("rejects legacy /uploads paths that are not part of this app", () => {
    // These point at files the old ATS app served; rendering them shows a
    // broken image, so the card falls back to the initials instead.
    expect(
      maidPhotoUrl({
        photoUrl:
          "/uploads/maids/agency-1/00111/photos/photo-1-7e2323a1-6ea7.jpg",
        photoUrls: ["/uploads/maids/agency-1/00111/photos/photo-2-af594.jpg"],
      }),
    ).toBeNull();
  });

  it("falls through to the next usable candidate", () => {
    expect(
      maidPhotoUrl({
        photoPortraitUrls: ["/uploads/portrait.jpg"],
        photoUrl: "",
        photoUrls: [STORAGE],
      }),
    ).toBe(STORAGE);
    expect(
      maidPhotoUrl({
        photoPortraitUrls: [],
        photoUrl: null,
        photoUrls: [],
        photoThumbnailUrls: [STORAGE.replace(".webp", "-thumb.webp")],
      }),
    ).toBe(STORAGE.replace(".webp", "-thumb.webp"));
  });

  it("returns null for missing, blank or non-http values", () => {
    expect(maidPhotoUrl({})).toBeNull();
    expect(maidPhotoUrl({ photoUrl: "   " })).toBeNull();
    expect(maidPhotoUrl({ photoUrl: "javascript:alert(1)" })).toBeNull();
    expect(maidPhotoUrl({ photoUrl: "photo.jpg" })).toBeNull();
  });
});

describe("maid initials", () => {
  it("uses first and last name", () => {
    expect(maidInitials("Anna Valdez")).toBe("AV");
    expect(maidInitials("Maricel Salinas Fontanilla")).toBe("MF");
    expect(maidInitials("  jonalyn   bodomo ")).toBe("JB");
  });

  it("uses the reference code for name-less rows", () => {
    expect(maidInitials("Maid SG-1042")).toBe("SG");
    expect(maidInitials("Maid SAMPLE-9-1-4")).toBe("SA");
  });

  it("never returns an empty placeholder", () => {
    expect(maidInitials("")).toBe("M");
    expect(maidInitials("   ")).toBe("M");
    expect(maidInitials("Maid")).toBe("MA");
  });
});
