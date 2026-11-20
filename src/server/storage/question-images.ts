import {
  validateQuestionImage,
} from "@/server/services/questions-schema";

export function storeQuestionImage(input: {
  imageDataBase64: string | null;
  imageMimeType: string | null;
}) {
  if (!input.imageDataBase64 || !input.imageMimeType) {
    return { imageData: null, imageMimeType: null };
  }

  const imageData = Buffer.from(input.imageDataBase64, "base64");
  if (!validateQuestionImage(imageData, input.imageMimeType)) {
    throw new Error("Gambar soal tidak valid atau melebihi 2 MB.");
  }

  // TODO: Replace the database byte storage with private Vercel Blob storage.
  return { imageData, imageMimeType: input.imageMimeType };
}
