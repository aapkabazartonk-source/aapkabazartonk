import { handleApiError, jsonOk, jsonUnauthorized } from "@/lib/api";
import { getAuthContext } from "@/lib/auth";
import { connectToDatabase } from "@/lib/db";
import { Business } from "@/models/Business";
import { User } from "@/models/User";

export async function GET(request: Request) {
  try {
    const auth = await getAuthContext(request);
    if (!auth.userId) {
      return jsonUnauthorized("Sign in is required.");
    }

    await connectToDatabase();
    const user = await User.findById(auth.userId)
      .select("name email role isActive sessionVersion avatarUrl businessId")
      .lean();

    if (!user || user.isActive === false) {
      return jsonUnauthorized("Sign in is required.");
    }

    if (
      typeof auth.sessionVersion === "number" &&
      (user.sessionVersion ?? 0) !== auth.sessionVersion
    ) {
      return jsonUnauthorized("Session expired. Please sign in again.");
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
