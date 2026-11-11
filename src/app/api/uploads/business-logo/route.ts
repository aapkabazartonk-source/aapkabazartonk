import { handleApiError, jsonError, jsonOk } from "@/lib/api";
import { uploadImageToCloudinary } from "@/lib/upload-image";
import { requireTenant } from "@/lib/tenant";

export async function POST(request: Request) {
  try {
    await requireTenant(request);

    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return jsonError("Logo image file is required.", 400);
    }

    const result = await uploadImageToCloudinary({
      file,
      folder: "aapkabazartonk/business",
    });

    return jsonOk({
      url: result.secure_url,
      publicId: result.public_id,
    });
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      "status" in error &&
      "message" in error
    ) {
      return jsonError(
        String((error as { message: string }).message),
        Number((error as { status: number }).status) || 400,
      );
    }
    return handleApiError(error);
  }
}
