import { Readable } from "node:stream";
import { getCloudinary } from "@/lib/cloudinary";

const ALLOWED_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);
const MAX_BYTES = 5 * 1024 * 1024;

export function validateImageFile(file: File) {
  if (!ALLOWED_TYPES.has(file.type)) {
    throw Object.assign(
      new Error("Only JPEG, PNG, WebP, and GIF images are allowed."),
      { status: 400 },
    );
  }
  if (file.size <= 0 || file.size > MAX_BYTES) {
    throw Object.assign(
      new Error("Image must be between 1 byte and 5 MB."),
      { status: 400 },
    );
  }
}

export async function uploadImageToCloudinary(params: {
  file: File;
  folder: string;
}) {
  validateImageFile(params.file);

  const cloudinary = getCloudinary();
  const buffer = Buffer.from(await params.file.arrayBuffer());

  return new Promise<{
    secure_url: string;
    public_id: string;
  }>((resolve, reject) => {
    const upload = cloudinary.uploader.upload_stream(
      {
        folder: params.folder,
        resource_type: "image",
      },
      (error, uploaded) => {
        if (error || !uploaded?.secure_url || !uploaded.public_id) {
          reject(error ?? new Error("Cloudinary upload failed."));
          return;
        }
        resolve({
          secure_url: uploaded.secure_url,
          public_id: uploaded.public_id,
        });
      },
    );

    Readable.from(buffer).pipe(upload);
  });
}
