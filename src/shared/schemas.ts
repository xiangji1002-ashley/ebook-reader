import { z } from 'zod';

export const bookIdSchema = z.string().uuid();

export const txtLocatorSchema = z.object({
  type: z.literal('text-offset'),
  offset: z.number().int().nonnegative(),
  context: z.string().max(200).optional(),
  percentage: z.number().min(0).max(1)
});

export const epubLocatorSchema = z.object({
  type: z.literal('epub-cfi'),
  cfi: z.string().min(1).max(4096),
  spineHref: z.string().max(2048).optional(),
  percentage: z.number().min(0).max(1).optional()
});

export const readingLocatorSchema = z.discriminatedUnion('type', [txtLocatorSchema, epubLocatorSchema]);
