import { BadRequestException } from "@nestjs/common";
import { z } from "zod";
export function parse<T>(schema: z.ZodType<T>, body: unknown): T {
  const result = schema.safeParse(body);
  if (!result.success)
    throw new BadRequestException({
      message: "Dados inválidos.",
      errors: result.error.flatten(),
    });
  return result.data;
}
export const uuid = z.uuid();
export const version = z.number().int().positive();
export const condition = z.number().int().min(1).max(5);
export const note = z.string().max(2000).default("");
export const assetInput = z
  .object({
    patrimony: z.string().trim().min(1).max(20),
    description: z.string().trim().min(1).max(255),
    group: z.string().trim().min(1).max(100),
    uniqueCode: z.string().trim().min(1).max(50),
    originUnit: z.string().trim().min(1).max(20),
    incorporationDate: z.iso.date(),
    value: z.string().regex(/^\d{1,13}(\.\d{1,2})?$/),
  })
  .strict();
export const scanInput = z
  .object({
    assetId: uuid,
    expectedVersion: version,
    observedAt: z.iso.datetime({ offset: true }),
    condition: condition.optional(),
    divergence: z
      .object({
        type: z.enum([
          "WRONG_LABEL",
          "WRONG_ITEM",
          "DUPLICATE",
          "WRONG_LOCATION",
          "OTHER",
        ]),
        foundDescription: z.string().min(1).max(255),
        notes: note,
      })
      .optional(),
  })
  .strict();
