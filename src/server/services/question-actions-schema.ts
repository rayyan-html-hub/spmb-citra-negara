import { z } from "zod";
import { QuestionBankStatus } from "@/generated/prisma/client";
import { questionIdSchema } from "@/server/services/questions-schema";

const questionStatusSchema = z.enum(QuestionBankStatus);

export const questionStatusChangeSchema = z.object({
  id: questionIdSchema,
  status: questionStatusSchema,
});
export const questionDeletionSchema = z.object({ id: questionIdSchema });
