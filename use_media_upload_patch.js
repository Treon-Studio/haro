const fs = require('fs');
const path = 'desktop/src/features/messages/lib/useMediaUpload.ts';
let content = fs.readFileSync(path, 'utf8');

content = content.replace(
  /import \{\n  type BlobDescriptor,\n  pickAndUploadMedia,\n  uploadMediaBytes,\n\} from "@\/shared\/api\/tauri";/,
  `import { type BlobDescriptor } from "@/shared/api/tauri";\nimport { uploadMedia } from "@/shared/api/simpleMediaUpload";`
);

// We need to implement pickAndUploadMedia using HTML input element since we removed it from tauri
const pickAndUploadMediaImplementation = `
async function pickAndUploadMedia(): Promise<BlobDescriptor[]> {
  return new Promise((resolve, reject) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.multiple = true;
    input.onchange = async (e) => {
      const files = Array.from((e.target as HTMLInputElement).files || []);
      try {
        const descriptors = await Promise.all(files.map(async (file) => {
          const url = await uploadMedia(file);
          return {
            url,
            sha256: file.name,
            size: file.size,
            type: file.type,
            uploaded: Date.now() / 1000,
            filename: file.name
          } as BlobDescriptor;
        }));
        resolve(descriptors);
      } catch (err) {
        reject(err);
      }
    };
    input.oncancel = () => resolve([]);
    input.click();
  });
}
`;

content = content.replace(
  /export function useMediaUpload\(\) \{/,
  pickAndUploadMediaImplementation + '\nexport function useMediaUpload() {'
);

// Replace uploadMediaBytes usage
content = content.replace(/await uploadMediaBytes\(\s*\[\.\.\.new Uint8Array\(buffer\)\],\s*file\.name,\s*uploadProgressId\(previewId\),\s*\)/g, 
  `await uploadMedia(file).then(url => ({ url, sha256: file.name, size: file.size, type: file.type, uploaded: Date.now() / 1000, filename: file.name } as BlobDescriptor))`
);

content = content.replace(/await uploadMediaBytes\(\s*\[\.\.\.bytes\],\s*filename,\s*uploadProgressId\(previewId\),\s*\)/g, 
  `await uploadMedia(new File([bytes], filename, { type: "image/png" })).then(url => ({ url, sha256: filename, size: bytes.length, type: "image/png", uploaded: Date.now() / 1000, filename } as BlobDescriptor))`
);

fs.writeFileSync(path, content);
