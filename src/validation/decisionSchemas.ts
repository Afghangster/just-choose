import { z } from "zod";

export const createDecisionSchema = z.object({
  note: z.string().optional(),
  options: z
    .array(
      z.object({
        title: z.string().optional(),
        imageUrl: z.string().nullable().optional(),
      }),
    )
    .min(2, "Add at least two options.")
    .max(6, "Use six options or fewer.")
    .refine(
      (options) => options.every((option) => option.title?.trim() || option.imageUrl),
      "Each option needs a name or a photo.",
    ),
});

export type CreateDecisionFormValues = z.infer<typeof createDecisionSchema>;
