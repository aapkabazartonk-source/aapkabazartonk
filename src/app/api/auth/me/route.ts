import { handleApiError, jsonError, jsonOk } from "@/lib/api";
import { getAuthContext } from "@/lib/auth";
import { connectToDatabase } from "@/lib/db";
import { Business } from "@/models/Business";
import { User } from "@/models/User";

export async function GET(request: Request) {
  try {
    const auth = await getAuthContext(request);
    if (!auth.userId) {
      return jsonError("Sign in is required.", 401);
    }

    await connectToDatabase();
    const user = await User.findById(auth.userId)
      .select("name email role isActive sessionVersion avatarUrl businessId")
      .lean();

    if (!user || user.isActive === false) {
      return jsonError("Sign in is required.", 401);
    }

    if (
      typeof auth.sessionVersion === "number" &&
      (user.sessionVersion ?? 0) !== auth.sessionVersion
    ) {
      return jsonError("Session expired. Please sign in again.", 401);
    }

    let ownerDisplayName = user.name || "";
    if (user.businessId) {
      const business = await Business.findById(user.businessId)
        .select("ownerName")
        .lean();
      const profileName = business?.ownerName?.trim() || "";
      if (profileName) ownerDisplayName = profileName;
    }

    return jsonOk({
      data: {
        id: String(user._id),
        name: user.name,
        ownerDisplayName,
        email: user.email,
        role: user.role,
        avatarUrl: user.avatarUrl || "",
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
