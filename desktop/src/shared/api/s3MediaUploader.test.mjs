import assert from "node:assert/strict";
import test from "node:test";
import { uploadMedia } from "./s3MediaUploader.ts";

const HEIC_BYTES = new Uint8Array([
  0, 0, 0, 24, 102, 116, 121, 112, 104, 101, 105, 99, 0, 0, 0, 0, 104, 101, 105,
  99, 109, 105, 102, 49,
]);

const MOV_BYTES = new Uint8Array([
  0, 0, 0, 20, 102, 116, 121, 112, 113, 116, 32, 32, 0, 0, 0, 0, 113, 116, 32,
  32,
]);

function nativeUpload(descriptor, output = {}) {
  return {
    descriptor,
    output: {
      mimeType: descriptor.type,
      sha256: descriptor.sha256,
      size: descriptor.size,
      ...output,
    },
  };
}

test("upload delegates bytes to Tauri Blossom command", async () => {
  const calls = [];
  const descriptor = {
    url: "http://154.26.132.120:3000/media/hash123",
    sha256: "039058c6f2c0cb492c533b0a4d14ef77cc0f78abccced5287d84a1a2011cfb81",
    size: 3,
    type: "image/png",
    uploaded: 1700000000,
  };

  const file = new File([new Uint8Array([1, 2, 3])], "a.png", {
    type: "image/png",
  });
  const result = await uploadMedia(file, async (command, args) => {
    calls.push({ command, args });
    return nativeUpload(descriptor);
  });

  assert.equal(calls[0].command, "upload_media_bytes");
  assert.deepEqual(calls[0].args.data, [1, 2, 3]);
  assert.equal(result.sha256, descriptor.sha256);
  assert.equal(result.url, descriptor.url);
});

test("upload rejects a native descriptor with mismatched MIME", async () => {
  const file = new File([new Uint8Array([1, 2, 3])], "a.png", {
    type: "image/png",
  });
  await assert.rejects(
    uploadMedia(file, async () =>
      nativeUpload(
        {
          url: "https://relay.example/media/hash",
          sha256:
            "039058c6f2c0cb492c533b0a4d14ef77cc0f78abccced5287d84a1a2011cfb81",
          size: 3,
          type: "image/jpeg",
          uploaded: 1,
        },
        { mimeType: "image/png" },
      ),
    ),
    /MIME/,
  );
});

test("upload accepts the JPEG descriptor produced for a HEIC source", async () => {
  const file = new File([HEIC_BYTES], "photo.heic", {
    type: "image/heic",
  });
  const descriptor = await uploadMedia(file, async () =>
    nativeUpload({
      url: "https://relay.example/media/jpeg-hash",
      sha256: "a".repeat(64),
      size: 99,
      type: "image/jpeg",
      uploaded: 1,
    }),
  );
  assert.equal(descriptor.type, "image/jpeg");
});

test("upload accepts native JPEG output for HEIC bytes with an octet-stream type", async () => {
  const file = new File([HEIC_BYTES], "pasted-image", {
    type: "application/octet-stream",
  });
  const descriptor = await uploadMedia(file, async () =>
    nativeUpload({
      url: "https://relay.example/media/jpeg-hash",
      sha256: "a".repeat(64),
      size: 99,
      type: "image/jpeg",
      uploaded: 1,
    }),
  );
  assert.equal(descriptor.type, "image/jpeg");
});

test("upload accepts the MP4 output contract produced for a MOV source", async () => {
  const file = new File([MOV_BYTES], "clip.mov", {
    type: "video/quicktime",
  });
  const descriptor = await uploadMedia(file, async () =>
    nativeUpload({
      url: "https://relay.example/media/mp4-hash",
      sha256: "b".repeat(64),
      size: 200,
      type: "video/mp4",
      uploaded: 1,
    }),
  );
  assert.equal(descriptor.type, "video/mp4");
});

test("upload accepts native MIME detection when the browser MIME is empty", async () => {
  const file = new File([new Uint8Array([1, 2, 3])], "pasted-file");
  const descriptor = await uploadMedia(file, async () =>
    nativeUpload({
      url: "https://relay.example/media/hash",
      sha256:
        "039058c6f2c0cb492c533b0a4d14ef77cc0f78abccced5287d84a1a2011cfb81",
      size: 3,
      type: "application/octet-stream",
      uploaded: 1,
    }),
  );
  assert.equal(descriptor.type, "application/octet-stream");
});

test("upload accepts a sanitized image output with changed bytes", async () => {
  const file = new File([new Uint8Array([1, 2, 3])], "image.png", {
    type: "image/png",
  });
  const descriptor = await uploadMedia(file, async () =>
    nativeUpload({
      url: "https://relay.example/media/sanitized-hash",
      sha256: "c".repeat(64),
      size: 120,
      type: "image/png",
      uploaded: 1,
    }),
  );
  assert.equal(descriptor.sha256, "c".repeat(64));
});

test("upload rejects a native descriptor with mismatched SHA-256", async () => {
  const file = new File([new Uint8Array([1, 2, 3])], "a.bin", {
    type: "application/octet-stream",
  });
  await assert.rejects(
    uploadMedia(file, async () =>
      nativeUpload(
        {
          url: "https://relay.example/media/hash",
          sha256: "0".repeat(64),
          size: 3,
          type: "application/octet-stream",
          uploaded: 1,
        },
        {
          sha256:
            "039058c6f2c0cb492c533b0a4d14ef77cc0f78abccced5287d84a1a2011cfb81",
        },
      ),
    ),
    /SHA-256/,
  );
});

test("upload surfaces native command failures", async () => {
  const file = new File([new Uint8Array([1, 2, 3])], "a.bin", {
    type: "application/octet-stream",
  });
  await assert.rejects(
    uploadMedia(file, async () => {
      throw new Error("native failed");
    }),
    /native failed/,
  );
});
