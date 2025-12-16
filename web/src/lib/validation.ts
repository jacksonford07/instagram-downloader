import { z } from 'zod';

export const DownloadRequestSchema = z.object({
  url: z
    .string()
    .min(1, 'URL is required')
    .refine(
      (url) => {
        const patterns = [
          /instagram\.com\/(p|reel|reels)\/[\w-]+/,
          /instagram\.com\/stories\/[\w.]+\/\d+/,
        ];
        return patterns.some((pattern) => pattern.test(url));
      },
      { message: 'Please enter a valid Instagram post, reel, or story URL' }
    ),
});

export const BatchDownloadRequestSchema = z.object({
  urls: z
    .array(z.string())
    .min(1, 'At least one URL is required')
    .max(10, 'Maximum 10 URLs per batch')
    .refine(
      (urls) => {
        const patterns = [
          /instagram\.com\/(p|reel|reels)\/[\w-]+/,
          /instagram\.com\/stories\/[\w.]+\/\d+/,
        ];
        return urls.every((url) => patterns.some((pattern) => pattern.test(url)));
      },
      { message: 'All URLs must be valid Instagram URLs' }
    ),
});

export type DownloadRequest = z.infer<typeof DownloadRequestSchema>;
export type BatchDownloadRequest = z.infer<typeof BatchDownloadRequestSchema>;
