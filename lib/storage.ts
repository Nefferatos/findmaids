type StorageBucket = "media" | "private";

function storageConfig() {
  const url = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error(
      "SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required for Supabase Storage.",
    );
  }
  return {
    url: url.replace(/\/$/, ""),
    serviceKey,
    mediaBucket: process.env.SUPABASE_MEDIA_BUCKET ?? "findmaids-media",
    privateBucket: process.env.SUPABASE_PRIVATE_BUCKET ?? "findmaids-private",
  };
}

function encodeObjectPath(objectPath: string) {
  return objectPath.split("/").map(encodeURIComponent).join("/");
}

export async function storeObject(input: {
  bucket: StorageBucket;
  key: string;
  body: Uint8Array;
  contentType: string;
  public?: boolean;
}) {
  const config = storageConfig();
  const bucket =
    input.bucket === "media" ? config.mediaBucket : config.privateBucket;
  const response = await fetch(
    `${config.url}/storage/v1/object/${encodeURIComponent(bucket)}/${encodeObjectPath(input.key)}`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.serviceKey}`,
        apikey: config.serviceKey,
        "Content-Type": input.contentType,
        "x-upsert": "true",
      },
      body: input.body as BodyInit,
      cache: "no-store",
    },
  );
  if (!response.ok) {
    throw new Error(`Supabase Storage upload failed (${response.status}).`);
  }
  return input.public
    ? `${config.url}/storage/v1/object/public/${encodeURIComponent(bucket)}/${encodeObjectPath(input.key)}`
    : input.key;
}

export async function readPrivateObject(key: string) {
  const config = storageConfig();
  const response = await fetch(
    `${config.url}/storage/v1/object/${encodeURIComponent(config.privateBucket)}/${encodeObjectPath(key)}`,
    {
      headers: {
        Authorization: `Bearer ${config.serviceKey}`,
        apikey: config.serviceKey,
      },
      cache: "no-store",
    },
  );
  if (!response.ok) {
    throw new Error(`Supabase Storage download failed (${response.status}).`);
  }
  return Buffer.from(await response.arrayBuffer());
}
