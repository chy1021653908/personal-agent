import { supabase } from "./client";

const BUCKET_NAME = "documents";

export async function uploadFile(
  userId: string,
  knowledgeBaseId: string,
  file: File
): Promise<{ url: string; path: string }> {
  const ext = file.name.split(".").pop();
  const path = `${userId}/${knowledgeBaseId}/${Date.now()}-${file.name}`;

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
  const { error } = await supabase.storage.from(BUCKET_NAME).remove([path]);
  if (error) throw new Error(`Delete failed: ${error.message}`);
}

export async function getFileBuffer(path: string): Promise<ArrayBuffer> {
  const { data, error } = await supabase.storage
    .from(BUCKET_NAME)
    .download(path);
  if (error) throw new Error(`Download failed: ${error.message}`);
  return data.arrayBuffer();
}
