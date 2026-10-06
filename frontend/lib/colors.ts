/**
 * Lightweight in-browser dominant color extractor for team logos and avatars.
 * Zero external dependencies. Uses an offscreen HTML5 canvas to sample pixels,
 * filters out transparent areas, borders, and pure black/white outlines,
 * and prioritizes vibrant team brand colors.
 */

import { useEffect, useState } from 'react';

export type RGB = [number, number, number];

export const DEFAULT_HOME_COLOR: RGB = [80, 200, 120]; // Nexus Emerald
export const DEFAULT_AWAY_COLOR: RGB = [200, 80, 160]; // Nexus Magenta

const colorCache = new Map<string, RGB>();

/**
 * Reusable React hook for extracting vibrant team brand colors from team avatar URLs.
 */
export function useTeamColors(homeAvatar?: string | null, awayAvatar?: string | null) {
  const [extractedHomeRgb, setExtractedHomeRgb] = useState<RGB | null>(null);
  const [extractedAwayRgb, setExtractedAwayRgb] = useState<RGB | null>(null);

  useEffect(() => {
    if (!homeAvatar) return;
    let active = true;
    extractDominantColor(homeAvatar, DEFAULT_HOME_COLOR).then((rgb) => {
      if (active) setExtractedHomeRgb(rgb);
    });
    return () => {
      active = false;
    };
  }, [homeAvatar]);

  useEffect(() => {
    if (!awayAvatar) return;
    let active = true;
    extractDominantColor(awayAvatar, DEFAULT_AWAY_COLOR).then((rgb) => {
      if (active) setExtractedAwayRgb(rgb);
    });
    return () => {
      active = false;
    };
  }, [awayAvatar]);

  const homeRgb = homeAvatar && extractedHomeRgb ? extractedHomeRgb : DEFAULT_HOME_COLOR;
  const awayRgb = awayAvatar && extractedAwayRgb ? extractedAwayRgb : DEFAULT_AWAY_COLOR;

  return { homeRgb, awayRgb };
}

/**
 * Calculates saturation from RGB values (0 to 1).
 */
function getSaturation(r: number, g: number, b: number): number {
  const max = Math.max(r, g, b) / 255;
  const min = Math.min(r, g, b) / 255;
  if (max === min) return 0;
  const d = max - min;
  const l = (max + min) / 2;
  return l > 0.5 ? d / (2 - max - min) : d / (max + min);
}

/**
 * Extracts the primary vibrant dominant color from an image URL.
 * Falls back gracefully to `fallback` if loading fails or CORS is blocked.
 */
export async function extractDominantColor(
  imageUrl: string | null | undefined,
  fallback: RGB
): Promise<RGB> {
  if (!imageUrl || typeof window === 'undefined') {
    return fallback;
  }

  const cached = colorCache.get(imageUrl);
  if (cached) {
    return cached;
  }

  return new Promise<RGB>((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';

    const cleanupAndResolve = (result: RGB) => {
      colorCache.set(imageUrl, result);
      resolve(result);
    };

    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        if (!ctx) {
          cleanupAndResolve(fallback);
          return;
        }

        // Downsample to a small canvas for fast pixel scanning
        const size = 48;
        canvas.width = size;
        canvas.height = size;
        ctx.drawImage(img, 0, 0, size, size);

        const imgData = ctx.getImageData(0, 0, size, size).data;
        const colorBuckets = new Map<string, { count: number; r: number; g: number; b: number; score: number }>();
        let nonTransparentPixels = 0;
        let avgR = 0;
        let avgG = 0;
        let avgB = 0;

        for (let i = 0; i < imgData.length; i += 4) {
          const r = imgData[i];
          const g = imgData[i + 1];
          const b = imgData[i + 2];
          const a = imgData[i + 3];

          // Skip transparent or semi-transparent background pixels
          if (a < 128) continue;

          nonTransparentPixels++;
          avgR += r;
          avgG += g;
          avgB += b;

          const brightness = (r * 299 + g * 587 + b * 114) / 1000;
          const saturation = getSaturation(r, g, b);

          // Skip extreme whites, dark blacks, and low-saturation grays (outlines/strokes)
          if (brightness > 245 || brightness < 20 || saturation < 0.18) {
            continue;
          }

          // Quantize color to 16-step buckets to cluster similar hues
          const qr = Math.round(r / 16) * 16;
          const qg = Math.round(g / 16) * 16;
          const qb = Math.round(b / 16) * 16;
          const key = `${qr},${qg},${qb}`;

          const existing = colorBuckets.get(key);
          // Score weights pixel count by saturation so vivid team colors win over dull tones
          const pixelScore = 1 + saturation * 3;

          if (existing) {
            existing.count += 1;
            existing.score += pixelScore;
            existing.r += r;
            existing.g += g;
            existing.b += b;
          } else {
            colorBuckets.set(key, {
              count: 1,
              score: pixelScore,
              r,
              g,
              b
            });
          }
        }

        // If no vibrant colors were found (e.g. monochrome/grayscale logo), use average non-transparent
        if (colorBuckets.size === 0) {
          if (nonTransparentPixels > 0) {
            const result: RGB = [
              Math.round(avgR / nonTransparentPixels),
              Math.round(avgG / nonTransparentPixels),
              Math.round(avgB / nonTransparentPixels)
            ];
            cleanupAndResolve(result);
            return;
          }
          cleanupAndResolve(fallback);
          return;
        }

        // Find the bucket with the highest weighted score
        type ColorBucket = { count: number; r: number; g: number; b: number; score: number };
        const buckets: ColorBucket[] = Array.from(colorBuckets.values());
        let bestBucket: ColorBucket | null = null;
        let maxScore = -1;

        for (let j = 0; j < buckets.length; j++) {
          const bucket = buckets[j];
          if (bucket.score > maxScore) {
            maxScore = bucket.score;
            bestBucket = bucket;
          }
        }

        if (bestBucket) {
          const result: RGB = [
            Math.round(bestBucket.r / bestBucket.count),
            Math.round(bestBucket.g / bestBucket.count),
            Math.round(bestBucket.b / bestBucket.count)
          ];
          cleanupAndResolve(result);
        } else {
          cleanupAndResolve(fallback);
        }
      } catch {
        // In case canvas is tainted by external CORS without permissive headers
        cleanupAndResolve(fallback);
      }
    };

    img.onerror = () => {
      cleanupAndResolve(fallback);
    };

    img.src = imageUrl;
  });
}
