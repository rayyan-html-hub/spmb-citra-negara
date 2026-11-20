import { del, put } from "@vercel/blob";
import { randomUUID } from "node:crypto";

export async function storePrivatePdf(bytes: Buffer) {
  const blob = await put(
    `eligibility-overrides/${randomUUID()}.pdf`,
    bytes,
    {
      access: "private",
      addRandomSuffix: true,
      contentType: "application/pdf",
      cacheControlMaxAge: 60,
    },
  );
  return blob.pathname;
}

export async function deletePrivateBlob(pathname: string) {
  await del(pathname);
}
