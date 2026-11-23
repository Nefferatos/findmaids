import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import JSZip from "jszip";
import { importedPhotoPatch, importedPhotoUrl } from "@/lib/maids/draft";
import {
  detectDocumentType,
  extractDocumentText,
} from "@/lib/maids/import/document";
import { extractMaidBiodata } from "@/lib/maids/import";
import { parseMaidBiodata } from "@/lib/maids/import/parse";
import { scorePhotoCandidate } from "@/lib/maids/import/photo";
import {
  parseDocumentDate,
  parseEducationLevel,
  parseHeightCm,
  parseProficiency,
} from "@/lib/maids/import/parse-rules";
import { findPortraitRegion } from "@/lib/maids/import/portrait";
import { cleanOcrText } from "@/lib/maids/import/ocr-text";

const encoder = new TextEncoder();
const pdfBytes = () => encoder.encode("%PDF-1.7\n1 0 obj\n<<>>\nendobj\n");

async function docxBytes(documentXml: string) {
  const zip = new JSZip();
  zip.file(
    "[Content_Types].xml",
    `<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>`,
  );
  zip.file(
    "word/document.xml",
    `<?xml version="1.0"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${documentXml}</w:body></w:document>`,
  );
  return new Uint8Array(await zip.generateAsync({ type: "uint8array" }));
}

const BIODATA_TEXT = [
  "MAID BIODATA FORM",
  "Full Name: Zin Mar Win",
  "Reference Code: MYR-ALL-9685",
  "Type: New maid",
  "Nationality: Myanmar",
  "Date of Birth: 11/05/1999",
  "Place of Birth: Myingyan",
  "Height: 150 cm",
  "Weight: 52 kg",
  "Religion: Buddhist",
  "Marital Status: Single",
  "Number of Children: 0",
  "Number of Siblings: 5",
  "Home Address: Magway",
  "Airport: Yangon",
  "Education Level: High School (10-12 yrs)",
  "Off Days: 2",
  "Expected Salary: $600",
  "English: Fair",
  "Hindi: Zero",
  "Cooking: 4/5 Willing: Yes Experience: Yes",
  "Care of elderly: 3/5",
  "Employment History",
  "2019 - 2022 | Myanmar | General household duties and childcare | Finished contract",
  "2023 - 2026 | Singapore | Chinese family | Elderly care and cooking | Finished contract",
  "Introduction",
  "Zin Mar Win is a dedicated helper with several years of childcare experience in Myanmar and Singapore.",
  "Asthma: No",
  "Allergies: None",
  "Work Permit No: 0 37317292",
].join("\n");

describe("document type detection", () => {
  it("accepts a PDF by its magic bytes", () => {
    expect(
      detectDocumentType({
        bytes: pdfBytes(),
        fileName: "biodata.pdf",
        mimeType: "application/pdf",
      }),
    ).toBe("pdf");
  });

  it("accepts a DOCX only when the archive contains word/document.xml", async () => {
    const bytes = await docxBytes("<w:p><w:r><w:t>Hello</w:t></w:r></w:p>");
    expect(
      detectDocumentType({
        bytes,
        fileName: "biodata.docx",
        mimeType:
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      }),
    ).toBe("docx");
  });

  it("rejects a mismatched extension, plain ZIPs and other files", async () => {
    const docx = await docxBytes("<w:p><w:r><w:t>Hello</w:t></w:r></w:p>");
    expect(() =>
      detectDocumentType({
        bytes: docx,
        fileName: "biodata.pdf",
        mimeType: "application/pdf",
      }),
    ).toThrow(/does not match/i);
    expect(() =>
      detectDocumentType({
        bytes: encoder.encode("PK\u0003\u0004not-a-docx"),
        fileName: "fake.docx",
        mimeType: "",
      }),
    ).toThrow(/not a Word/i);
    expect(() =>
      detectDocumentType({
        bytes: encoder.encode("just some text"),
        fileName: "notes.txt",
        mimeType: "text/plain",
      }),
    ).toThrow(/Upload a PDF or Word/i);
  });

  it("rejects oversized and empty files before parsing", () => {
    expect(() =>
      detectDocumentType({
        bytes: new Uint8Array(8 * 1024 * 1024 + 1),
        fileName: "big.pdf",
        mimeType: "application/pdf",
      }),
    ).toThrow(/larger than 8 MB/i);
    expect(() =>
      detectDocumentType({
        bytes: new Uint8Array(0),
        fileName: "empty.pdf",
        mimeType: "application/pdf",
      }),
    ).toThrow(/empty/i);
  });
});

describe("value normalisation", () => {
  it("reads day-first dates and flags ambiguity", () => {
    expect(parseDocumentDate("11/05/1999")).toEqual({
      value: "1999-05-11",
      review: expect.stringMatching(/ambiguous/i),
    });
    expect(parseDocumentDate("1999-05-11")?.value).toBe("1999-05-11");
    expect(parseDocumentDate("25/12/1990")?.value).toBe("1990-12-25");
    expect(parseDocumentDate("12 March 1993")?.value).toBe("1993-03-12");
    expect(parseDocumentDate("not a date")).toBeNull();
  });

  it("converts heights and clamps invalid numbers", () => {
    expect(parseHeightCm("160 cm")?.value).toBe("160");
    expect(parseHeightCm("1.58 m")?.value).toBe("158");
    expect(parseHeightCm("5'3\"")?.value).toBe("160");
    expect(parseHeightCm("320")?.value).toBe("");
  });

  it("maps language levels onto the form vocabulary", () => {
    expect(parseProficiency("basic")?.value).toBe("Little");
    expect(parseProficiency("Fluent")?.value).toBe("Excellent");
    expect(parseProficiency("Good")?.value).toBe("Good");
  });
});

describe("rules parser", () => {
  const result = parseMaidBiodata(BIODATA_TEXT);

  it("maps identity, physical and education fields", () => {
    expect(result.draft.fullName).toBe("Zin Mar Win");
    expect(result.draft.reference).toBe("MYR-ALL-9685");
    expect(result.draft.placementType).toBe("New maid");
    expect(result.draft.nationality).toBe("Myanmar maid");
    expect(result.draft.dateOfBirth).toBe("1999-05-11");
    expect(result.draft.placeOfBirth).toBe("Myingyan");
    expect(result.draft.height).toBe("150");
    expect(result.draft.weight).toBe("52");
    expect(result.draft.religion).toBe("Buddhist");
    expect(result.draft.maritalStatus).toBe("Single");
    expect(result.draft.children).toBe("0");
    expect(result.draft.siblings).toBe("5");
    expect(result.draft.educationLevel).toBe("High School (10-12 yrs)");
    expect(result.draft.age).toBe(
      String(
        new Date().getUTCFullYear() -
          1999 -
          (new Date().getUTCMonth() < 4 ? 1 : 0),
      ),
    );
  });

  it("maps language proficiencies and derives the spoken list", () => {
    expect(result.draft.languageSkills).toMatchObject({
      English: "Fair",
      Hindi: "Zero",
    });
    expect(result.draft.languages).toBe("English");
  });

  it("maps work areas with ratings, willingness and experience", () => {
    expect(result.draft.workAreas?.Cooking).toEqual({
      rating: "4",
      note: "",
      willing: true,
      experience: true,
      years: "",
    });
    expect(result.draft.workAreas?.["Care of elderly"]?.rating).toBe("3");
  });

  it("keeps employment records separate", () => {
    expect(result.draft.employment).toHaveLength(2);
    expect(result.draft.employment?.[0]).toMatchObject({
      from: "2019",
      to: "2022",
      country: "Myanmar",
      remarks: "Finished contract",
    });
    expect(result.draft.employment?.[1]).toMatchObject({
      from: "2023",
      to: "2026",
      country: "Singapore",
      employer: "Chinese family",
    });
    expect(result.draft.employment?.[0]?.duties).not.toBe(
      result.draft.employment?.[1]?.duties,
    );
  });

  it("maps introduction, medical and private details", () => {
    expect(result.draft.introduction).toContain("dedicated helper");
    expect(result.draft.pastIllnesses?.["(III) Asthma"]).toBe(false);
    expect(result.draft.allergies).toBe("None");
    expect(result.draft.privateInfo).toContain("Work Permit No");
    expect(result.draft.offDaysPerMonth).toBe("2");
    expect(result.draft.expectedSalary).toBe("600");
  });

  it("never invents values that are absent from the document", () => {
    const sparse = parseMaidBiodata("Name: Test Helper");
    expect(sparse.draft.fullName).toBe("Test Helper");
    expect(sparse.draft.height).toBeUndefined();
    expect(sparse.draft.dateOfBirth).toBeUndefined();
    expect(sparse.draft.employment).toBeUndefined();
    expect(sparse.draft.introduction).toBeUndefined();
    expect(sparse.draft.languageSkills).toBeUndefined();
    expect(sparse.found).toEqual(["fullName"]);
    expect(sparse.warnings.length).toBeGreaterThan(0);
  });

  it("flags conflicting values instead of choosing silently", () => {
    const conflicted = parseMaidBiodata(
      [
        "Full Name: First Name",
        "Full Name: Second Name",
        "Height: 150 cm",
      ].join("\n"),
    );
    expect(conflicted.draft.fullName).toBe("First Name");
    expect(
      conflicted.review.some((item) =>
        /Conflicting values/i.test(item.message),
      ),
    ).toBe(true);
  });

  it("flags an age that disagrees with the birth date", () => {
    const conflicted = parseMaidBiodata(
      ["Date of Birth: 11/05/1999", "Age: 12"].join("\n"),
    );
    expect(
      conflicted.review.some((item) =>
        /but the birth date/i.test(item.message),
      ),
    ).toBe(true);
  });
});

describe("POST /api/agency/maids/import", () => {
  it("requires an agency session and a supported file", async () => {
    vi.resetModules();
    vi.doMock("@/auth", () => ({ auth: vi.fn() }));
    vi.doMock("@/lib/rate-limit", () => ({
      checkRateLimit: vi.fn(async () => ({ allowed: true })),
    }));
    process.env.PRISMA_MOCK = "true";
    const { auth } = await import("@/auth");
    const route = await import("@/app/api/agency/maids/import/route");
    const { prisma } = await import("@/lib/prisma");
    const authMock = vi.mocked(auth);

    const request = (file?: File) => {
      const body = new FormData();
      if (file) body.set("file", file);
      return new Request("http://localhost/api/agency/maids/import", {
        method: "POST",
        body,
      });
    };

    authMock.mockResolvedValue(null as never);
    expect((await route.POST(request())).status).toBe(401);

    authMock.mockResolvedValue({
      user: { id: "user-1", role: "VISITOR", email: "v@example.test" },
      expires: "",
    } as never);
    expect((await route.POST(request())).status).toBe(401);

    authMock.mockResolvedValue({
      user: { id: "owner-1", role: "AGENCY", email: "a@example.test" },
      expires: "",
    } as never);
    const user = await prisma.user.create({
      data: { email: "owner-import@example.test", name: "Import Owner" },
    });
    await prisma.agency.create({
      data: {
        ownerId: user.id,
        name: "Import Agency",
        slug: "import-agency",
        description: "Agency for the maid import tests.",
        address: "1 Import Road",
        city: "Singapore",
        province: "Central Region",
        phone: "+65 6000 1111",
        email: "import@example.test",
        services: ["Full-time placement"],
        serviceLocations: ["Singapore"],
        nationalitiesServed: ["Myanmar"],
        languages: ["English"],
        status: "APPROVED",
        verifiedBadge: false,
        profileCompleteness: 0,
        onboardingStep: 1,
        foundingAgency: false,
      },
    });
    authMock.mockResolvedValue({
      user: { id: user.id, role: "AGENCY", email: user.email },
      expires: "",
    } as never);

    expect((await route.POST(request())).status).toBe(400);

    const textFile = new File(["hello"], "notes.txt", { type: "text/plain" });
    const rejected = await route.POST(request(textFile));
    expect(rejected.status).toBe(400);
    expect((await rejected.json()).code).toBe("unsupported_type");

    const documentXml =
      "<w:p><w:r><w:t>Full Name: Test Maid</w:t></w:r></w:p><w:p><w:r><w:t>Height: 160 cm</w:t></w:r></w:p>";
    const docx = new File([await docxBytes(documentXml)], "biodata.docx", {
      type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    });
    const response = await route.POST(request(docx));
    expect(response.status).toBe(200);
    const result = await response.json();
    expect(result.draft.fullName).toBe("Test Maid");
    expect(result.draft.height).toBe("160");
    expect(result.meta.source).toBe("docx");
    expect(result.meta.extractor).toBe("rules");
    expect(result.found).toContain("fullName");

    // Importing never creates a maid profile.
    expect(await prisma.maid.count()).toBe(0);
  }, 30_000);

  function rawPhoto(
    width: number,
    height: number,
    paint: (x: number, y: number) => [number, number, number],
  ) {
    const data = new Uint8Array(width * height * 3);
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const [r, g, b] = paint(x, y);
        const offset = (y * width + x) * 3;
        data[offset] = r;
        data[offset + 1] = g;
        data[offset + 2] = b;
      }
    }
    return { width, height, channels: 3, data };
  }

  /** Blue backdrop with a warm figure in the middle, like a studio portrait. */
  const portraitPhoto = () =>
    rawPhoto(600, 800, (x, y) =>
      x > 200 && x < 400 && y > 150 && y < 700
        ? [220, 180, 150]
        : [30, 120, 200],
    );

  /** Mostly white page with faint text, like a scanned form. */
  const scannedPage = () =>
    rawPhoto(1240, 1754, (x, y) =>
      (x + y) % 97 === 0 ? [30, 30, 30] : [248, 248, 248],
    );

  describe("embedded photo detection", () => {
    it("accepts a colourful, portrait-shaped image", () => {
      expect(scorePhotoCandidate(portraitPhoto())).not.toBeNull();
    });

    it("rejects page scans, wide banners and tiny icons", () => {
      expect(scorePhotoCandidate(scannedPage())).toBeNull();
      expect(
        scorePhotoCandidate(
          rawPhoto(1200, 240, (x, y) => [x % 255, y % 255, 120]),
        ),
      ).toBeNull();
      expect(
        scorePhotoCandidate(rawPhoto(96, 128, () => [40, 140, 210])),
      ).toBeNull();
    });

    it("rejects monochrome images and malformed bitmaps", () => {
      const grey = rawPhoto(600, 800, (x) => {
        const value = 40 + (x % 180);
        return [value, value, value];
      });
      expect(scorePhotoCandidate(grey)).toBeNull();
      const colour = portraitPhoto();
      expect(scorePhotoCandidate({ ...colour, channels: 2 })).toBeNull();
      expect(
        scorePhotoCandidate({ ...colour, data: colour.data.slice(0, 120) }),
      ).toBeNull();
    });
  });

  describe("imported photo merge", () => {
    const url = "https://example.test/photo.webp";

    it("reads a usable photo URL from either draft key", () => {
      expect(importedPhotoUrl({ photoUrl: ` ${url} ` })).toBe(url);
      expect(importedPhotoUrl({ photoUrls: [url] })).toBe(url);
      expect(importedPhotoUrl({ photoUrl: "   ", photoUrls: [] })).toBe("");
    });

    it("fills an empty form and keeps photos the admin already uploaded", () => {
      expect(
        importedPhotoPatch({ photoUrl: "", photoUrls: [] }, { photoUrl: url }),
      ).toEqual({ photoUrl: url, photoUrls: [url] });
      expect(
        importedPhotoPatch(
          {
            photoUrl: "https://example.test/mine.webp",
            photoUrls: ["https://example.test/mine.webp"],
          },
          { photoUrl: url },
        ),
      ).toBeNull();
      // A manually typed primary-photo URL also wins over the document photo.
      expect(
        importedPhotoPatch(
          { photoUrl: "https://example.test/mine.webp", photoUrls: [] },
          { photoUrl: url },
        ),
      ).toBeNull();
    });
  });
});

describe("POST /api/agency/maids/import photo attachment", () => {
  async function loadRoute(
    options: { failUpload?: boolean; needsOcr?: boolean } = {},
  ) {
    vi.resetModules();
    const buffers: ArrayBufferLike[] = [];
    const storeObject = vi.fn(async () => {
      if (options.failUpload) throw new Error("storage unavailable");
      return "https://example.test/photo.webp";
    });
    const baseResult = () => ({
      draft: {},
      found: [],
      missing: [],
      review: [],
      warnings: [],
      meta: {
        source: "pdf" as const,
        fileName: "biodata.pdf",
        bytes: 12,
        characters: 12,
        extractor: "rules" as const,
        aiConfigured: false,
        truncated: false,
        ocr: "not_needed" as const,
        needsOcr: options.needsOcr ?? false,
      },
    });

    vi.doMock("@/auth", () => ({
      auth: vi.fn(async () => ({
        user: { id: "owner-1", role: "AGENCY" },
        expires: "",
      })),
    }));
    vi.doMock("@/lib/rate-limit", () => ({
      checkRateLimit: vi.fn(async () => ({ allowed: true })),
    }));
    vi.doMock("@/lib/prisma", () => ({
      prisma: {
        agency: { findUnique: vi.fn(async () => ({ id: "agency-1" })) },
      },
    }));
    vi.doMock("@/lib/storage", () => ({ storeObject }));
    vi.doMock("@/lib/maids/import", () => ({
      extractMaidBiodata: vi.fn(async (input: { bytes: Uint8Array }) => {
        buffers.push(input.bytes.buffer);
        return baseResult();
      }),
    }));
    vi.doMock("@/lib/maids/import/photo", () => ({
      extractDocumentPhoto: vi.fn(async (input: { bytes: Uint8Array }) => {
        buffers.push(input.bytes.buffer);
        return {
          bytes: new Uint8Array([1, 2, 3]),
          width: 600,
          height: 800,
          contentType: "image/webp" as const,
          source: "pdf" as const,
        };
      }),
    }));

    const route = await import("@/app/api/agency/maids/import/route");
    const post = () => {
      const form = new FormData();
      form.set(
        "file",
        new File(
          [new TextEncoder().encode("%PDF-1.7 biodata")],
          "biodata.pdf",
          {
            type: "application/pdf",
          },
        ),
      );
      return route.POST(
        new Request("http://localhost/api/agency/maids/import", {
          method: "POST",
          body: form,
        }),
      );
    };

    return { post, buffers, storeObject };
  }

  it("uploads the detected photo without sharing pdf.js buffers", async () => {
    const { post, buffers, storeObject } = await loadRoute();
    const response = await post();
    expect(response.status).toBe(200);
    const result = await response.json();

    expect(result.draft.photoUrl).toBe("https://example.test/photo.webp");
    expect(result.draft.photoUrls).toEqual(["https://example.test/photo.webp"]);
    expect(result.found).toContain("photoUrl");
    expect(result.meta.photo).toEqual({
      found: true,
      uploaded: true,
      width: 600,
      height: 800,
    });
    expect(storeObject).toHaveBeenCalledTimes(1);

    // pdf.js transfers the buffer it parses; a shared buffer would detach the
    // one used by the other parse and fail both.
    expect(buffers).toHaveLength(2);
    expect(buffers[0]).not.toBe(buffers[1]);
  });

  it("keeps the text import when the photo upload fails", async () => {
    const { post } = await loadRoute({ failUpload: true });
    const response = await post();
    expect(response.status).toBe(200);
    const result = await response.json();

    expect(result.draft.photoUrl).toBeUndefined();
    expect(result.meta.photo).toEqual({
      found: true,
      uploaded: false,
      width: 600,
      height: 800,
    });
    expect(result.warnings.join(" ")).toMatch(/could not be uploaded/i);
  });

  it("leaves scanned-page portraits to the browser OCR crop", async () => {
    const { post, storeObject } = await loadRoute({ needsOcr: true });
    const response = await post();
    expect(response.status).toBe(200);
    const result = await response.json();

    expect(result.draft.photoUrl).toBeUndefined();
    expect(result.meta.photo).toEqual({ found: false, uploaded: false });
    expect(storeObject).not.toHaveBeenCalled();
  });
});

const A1_FORM_TEXT = [
  "1. Name: Man Sian Nem",
  "2. Date of birth: 2 d 6 d 0 m 4 m 0 y 2 y Age: 2 4",
  "3. Place of birth: Tedim",
  "4. Height & weight: 1 6 0 cm 5 0 kg",
  "5. Nationality: Myanmar",
  "6. Residential address in home country: Kaptel Village, Tedim Township",
  "7. Name of port / airport to be repatriated to: Yangon",
  "9. Religion: Christian",
  "10. Education level: Grade 9 {India}",
  "11. Number of siblings: 4",
  "12. Marital status: Single",
  "13. Number of children: -",
  "14. Allergies (if any): -",
  "16. Physical disabilities: -",
  "19. Preference for rest day: 1 rest day(s) per month.",
  "FDW is not available for interview",
  "FDW can be interviewed by phone",
  "FDW can be interviewed by video-conference",
  "FDW can be interviewed in person",
].join("\n");

describe("OCR text cleanup", () => {
  it("removes form underlines, box borders and checkbox tokens", () => {
    const cleaned = cleanOcrText(
      [
        "1. Name: __ Cecilia Cing Hawm Lian",
        "3. Place of birth: _Tedim",
        "6. Residential address in home country: __Dimpi Village, Tedim Township",
        "7. Name of port / airport to be repatriated to: __ Yangon 4",
        "18. Food handling preferences: 0 No pork OI No beef O",
      ].join("\n"),
    );

    expect(cleaned).toContain("Name: Cecilia Cing Hawm Lian");
    expect(cleaned).toContain("Place of birth: Tedim");
    expect(cleaned).toContain(
      "Residential address in home country: Dimpi Village",
    );
    expect(cleaned).toContain("repatriated to: Yangon 4");
    expect(cleaned).toContain("Food handling preferences: No pork No beef");

    const result = parseMaidBiodata(cleaned);
    expect(result.draft.fullName).toBe("Cecilia Cing Hawm Lian");
    expect(result.draft.placeOfBirth).toBe("Tedim");
    expect(result.draft.homeAddress).toBe("Dimpi Village, Tedim Township");
    expect(result.draft.airportRepatriation).toBe("Yangon");
    expect(result.draft.foodHandlingPreferences).toBe("No pork No beef");
  });
});

describe("form-style PDF text (numbered labels, boxed values)", () => {
  it("reads boxed dates as day/month/year", () => {
    expect(parseDocumentDate("2 d 6 d 0 m 4 m 0 y 2 y Age: 2 4")?.value).toBe(
      "2002-04-26",
    );
    expect(parseDocumentDate("2 6 0 4 2 0 0 2")?.value).toBe("2002-04-26");
  });

  it("maps grade levels onto the form's education options", () => {
    expect(parseEducationLevel("Grade 9 {India}")?.value).toBe(
      "Secondary Level (7-9 yrs)",
    );
    expect(parseEducationLevel("Grade 12")?.value).toBe(
      "High School (10-12 yrs)",
    );
    expect(parseEducationLevel("Grade 4")?.value).toBe("Primary (1-6 yrs)");
  });

  it("fills the A-1 fields and leaves placeholders empty", () => {
    const result = parseMaidBiodata(A1_FORM_TEXT);

    expect(result.draft.fullName).toBe("Man Sian Nem");
    expect(result.draft.dateOfBirth).toBe("2002-04-26");
    expect(result.draft.age).toBe("24");
    expect(result.draft.placeOfBirth).toBe("Tedim");
    expect(result.draft.height).toBe("160");
    expect(result.draft.weight).toBe("50");
    expect(result.draft.nationality).toBe("Myanmar maid");
    expect(result.draft.airportRepatriation).toBe("Yangon");
    expect(result.draft.religion).toBe("Christian");
    expect(result.draft.educationLevel).toBe("Secondary Level (7-9 yrs)");
    expect(result.draft.siblings).toBe("4");
    expect(result.draft.maritalStatus).toBe("Single");
    expect(result.draft.offDaysPerMonth).toBe("1");

    // Dashes are placeholders, and an unmarked option list is not an answer.
    expect(result.draft.children).toBeUndefined();
    expect(result.draft.allergies).toBeUndefined();
    expect(result.draft.physicalDisabilities).toBeUndefined();
    expect(result.draft.interviewOptions).toBeUndefined();
    expect(result.draft.employment).toBeUndefined();
  });
});

function pageImage(
  width: number,
  height: number,
  paint: (x: number, y: number) => [number, number, number, number] | null,
) {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const offset = (y * width + x) * 4;
      const pixel = paint(x, y) ?? [255, 255, 255, 255];
      data[offset] = pixel[0];
      data[offset + 1] = pixel[1];
      data[offset + 2] = pixel[2];
      data[offset + 3] = pixel[3];
    }
  }
  return { width, height, data };
}

describe("scanned page portrait detection", () => {
  it("finds a colour portrait block on a white page", () => {
    const image = pageImage(400, 560, (x, y) =>
      x >= 250 && x < 340 && y >= 60 && y < 190 ? [30, 120, 200, 255] : null,
    );
    const region = findPortraitRegion(image);
    expect(region).not.toBeNull();
    expect(region?.x).toBeGreaterThanOrEqual(245);
    expect(region?.x).toBeLessThanOrEqual(255);
    expect(region?.width).toBeGreaterThanOrEqual(85);
  });

  it("ignores text lines, banners and blank pages", () => {
    const text = pageImage(400, 560, (x, y) =>
      y % 14 === 0 && x > 20 && x < 380 ? [20, 20, 20, 255] : null,
    );
    expect(findPortraitRegion(text)).toBeNull();

    const banner = pageImage(400, 560, (x, y) =>
      x >= 40 && x < 360 && y >= 40 && y < 100 ? [200, 40, 60, 255] : null,
    );
    expect(findPortraitRegion(banner)).toBeNull();

    expect(findPortraitRegion(pageImage(400, 560, () => null))).toBeNull();
  });

  it("expands past white clothing to the whole portrait", () => {
    const image = pageImage(400, 560, (x, y) => {
      const photo = x >= 250 && x < 350 && y >= 100 && y < 240;
      if (!photo) return null;
      const shirt = y >= 160 && y < 210 && x >= 270 && x < 330;
      return shirt ? [255, 255, 255, 255] : [30, 120, 200, 255];
    });
    const region = findPortraitRegion(image);
    expect(region).not.toBeNull();
    expect(region?.width).toBeGreaterThanOrEqual(95);
    expect(region?.height).toBeGreaterThanOrEqual(135);
  });
});

describe("scanned PDF detection", () => {
  it("flags an image-only PDF for OCR and targets its page", async () => {
    const bytes = new Uint8Array(
      readFileSync("tests/fixtures/scanned-biodata.pdf"),
    );
    const document = await extractDocumentText({
      bytes: bytes.slice(),
      fileName: "scanned-biodata.pdf",
      mimeType: "application/pdf",
    });
    expect(document.looksScanned).toBe(true);
    expect(document.pageCharacters).toEqual([0]);

    const result = await extractMaidBiodata({
      bytes: bytes.slice(),
      fileName: "scanned-biodata.pdf",
      mimeType: "application/pdf",
    });
    expect(result.meta.needsOcr).toBe(true);
    expect(result.meta.ocrPages).toEqual([1]);
    expect(result.draft).toEqual({});
  }, 30_000);
});

describe("POST /api/agency/maids/import/ocr", () => {
  it("maps scanned text to form fields without storing it", async () => {
    vi.resetModules();
    vi.doMock("@/auth", () => ({
      auth: vi.fn(async () => ({
        user: { id: "owner-1", role: "AGENCY" },
        expires: "",
      })),
    }));
    vi.doMock("@/lib/rate-limit", () => ({
      checkRateLimit: vi.fn(async () => ({ allowed: true })),
    }));
    vi.doMock("@/lib/prisma", () => ({
      prisma: {
        agency: { findUnique: vi.fn(async () => ({ id: "agency-1" })) },
      },
    }));
    const route = await import("@/app/api/agency/maids/import/ocr/route");

    const request = (body: unknown) =>
      new Request("http://localhost/api/agency/maids/import/ocr", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

    const response = await route.POST(request({ text: A1_FORM_TEXT }));
    expect(response.status).toBe(200);
    const result = await response.json();
    expect(result.draft.fullName).toBe("Man Sian Nem");
    expect(result.draft.height).toBe("160");
    expect(result.found).toContain("dateOfBirth");

    expect((await route.POST(request({ text: "too short" }))).status).toBe(400);
  });
});
