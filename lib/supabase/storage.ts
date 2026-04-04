import { supabase } from "./client";

const BUCKET_NAME = "documents";

let bucketCheckPromise: Promise<void> | null = null;

async function ensureBucketExists() {
  if (bucketCheckPromise) return bucketCheckPromise;

  bucketCheckPromise = (async () => {
    const { data: buckets, error: listError } =
      await supabase.storage.listBuckets();
    if (listError)
      throw new Error(`Failed to list buckets: ${listError.message}`);

    if (!buckets.find((b) => b.name === BUCKET_NAME)) {
      const { error: createError } = await supabase.storage.createBucket(
        BUCKET_NAME,
        {
          public: true,
          fileSizeLimit: 52428800, // 50MB
        }
      );
      if (createError && createError.message !== "Bucket already exists") {
        throw new Error(`Failed to create bucket: ${createError.message}`);
      }
    }
  })();

  return bucketCheckPromise;
}

export async function uploadFile(
  userId: string,
  knowledgeBaseId: string,
  file: File
): Promise<{ url: string; path: string }> {
  await ensureBucketExists();
  const ext = file.name.split(".").pop();
  const safeFileName = encodeURIComponent(file.name).replace(/%/g, "_");
  const path = `${userId}/${knowledgeBaseId}/${Date.now()}-${safeFileName}`;

  const { error } = await supabase.storage
    .from(BUCKET_NAME)
    .upload(path, file, {
      contentType: file.type,
      upsert: false,
    });

  if (error) throw new Error(`Upload failed: ${error.message}`);

  const {
    data: { publicUrl },
  } = supabase.storage.from(BUCKET_NAME).getPublicUrl(path);

  return { url: publicUrl, path };
}

export async function deleteFile(path: string): Promise<void> {
  await ensureBucketExists();
  const { error } = await supabase.storage.from(BUCKET_NAME).remove([path]);
  if (error) throw new Error(`Delete failed: ${error.message}`);
}

export async function getFileBuffer(path: string): Promise<ArrayBuffer> {
  await ensureBucketExists();
  const { data, error } = await supabase.storage
    .from(BUCKET_NAME)
    .download(path);
  if (error) throw new Error(`Download failed: ${error.message}`);
  return data.arrayBuffer();
}
