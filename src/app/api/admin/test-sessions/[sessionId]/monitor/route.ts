import { requireRole } from "@/server/auth/access";
import { getTestSessionMonitor, TestManagementError } from "@/server/services/tests";

export async function GET(
  _request: Request,
  context: { params: Promise<{ sessionId: string }> },
) {
  await requireRole("ADMIN");
  const { sessionId } = await context.params;
  if (!sessionId || sessionId.length > 64) {
    return Response.json({ message: "ID sesi tidak valid." }, { status: 400 });
  }
  try {
    const monitor = await getTestSessionMonitor(sessionId);
    return Response.json(
      { monitor, polledAt: new Date().toISOString() },
      { headers: { "Cache-Control": "no-store, max-age=0" } },
    );
  } catch (error) {
    if (error instanceof TestManagementError) {
      return Response.json({ message: error.message }, { status: 404 });
    }
    throw error;
  }
}
