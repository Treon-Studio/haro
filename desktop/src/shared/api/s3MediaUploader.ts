import type { BlobDescriptor, NativeMediaUploadResult } from "./tauri.ts";
import { invokeTauri, validateNativeMediaUploadResult } from "./tauri.ts";

export async function uploadMedia(
  file: File,
  invoker: <T>(
    command: string,
    args?: Record<string, unknown>,
  ) => Promise<T> = invokeTauri,
): Promise<BlobDescriptor> {
  const data = new Uint8Array(await file.arrayBuffer());
  const result = await invoker<NativeMediaUploadResult>("upload_media_bytes", {
    data: Array.from(data),
    filename: file.name,
  });
  return validateNativeMediaUploadResult(result);
}
