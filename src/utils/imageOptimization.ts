import type { ImageMetadata } from "astro";
import { getImage } from "astro:assets";

// Cache for optimized images
const imageCache = new Map<string, Promise<any>>();

interface OptimizeImageOptions {
  width?: number;
  height?: number;
  format?: "avif" | "webp" | "png" | "jpg";
  quality?: number;
  fit?: "cover" | "contain" | "fill" | "inside" | "outside";
  position?:
    | "top"
    | "right top"
    | "right"
    | "right bottom"
    | "bottom"
    | "left bottom"
    | "left"
    | "left top"
    | "center";
  background?: string;
}

interface ResponsiveImageOptions {
  sizes: number[];
  format?: "avif" | "webp";
  quality?: number;
  fit?: OptimizeImageOptions["fit"];
  position?: OptimizeImageOptions["position"];
  minWidth?: number;
  maxWidth?: number;
}

/**
 * Optimizes an image with caching and error handling
 */
export async function optimizeImage(
  image: ImageMetadata,
  options: OptimizeImageOptions = {}
) {
  try {
    const {
      width,
      height,
      format = "webp",
      quality = 80,
      fit = "cover",
      position = "center",
      background,
    } = options;

    // Generate cache key
    const cacheKey = `${image.src}-${width}-${height}-${format}-${quality}-${fit}-${position}-${background}`;

    // Check cache first
    if (imageCache.has(cacheKey)) {
      return imageCache.get(cacheKey);
    }

    // Process image
    const imagePromise = getImage({
      src: image,
      width,
      height,
      format,
      quality,
      fit,
      position,
      background,
    });

    // Store in cache
    imageCache.set(cacheKey, imagePromise);

    const optimizedImage = await imagePromise;
    return optimizedImage;
  } catch (error) {
    console.error("Image optimization failed:", error);
    // Return original image as fallback
    return { src: image.src, width: image.width, height: image.height };
  }
}

/**
 * Generates responsive images with multiple sizes and formats
 */
export async function generateResponsiveImages(
  image: ImageMetadata,
  options: ResponsiveImageOptions
) {
  const {
    sizes,
    format = "webp",
    quality,
    fit,
    position,
    minWidth = 320,
    maxWidth = Math.min(1920, image.width),
  } = options;

  try {
    // Filter sizes based on min/max width
    const validSizes = sizes.filter(
      size => size >= minWidth && size <= maxWidth
    );

    // Sort sizes for consistency
    const sortedSizes = [...new Set(validSizes)].sort((a, b) => a - b);

    // Generate images in parallel
    const images = await Promise.all(
      sortedSizes.map(async width => {
        const optimized = await optimizeImage(image, {
          width,
          format,
          quality,
          fit,
          position,
        });

        return {
          src: optimized.src,
          width,
          height: optimized.height,
          format: optimized.format,
        };
      })
    );

    return images;
  } catch (error) {
    console.error("Responsive image generation failed:", error);
    // Return original image as fallback
    return [
      {
        src: image.src,
        width: image.width,
        height: image.height,
        format: "original",
      },
    ];
  }
}

/**
 * Clears the image optimization cache
 */
export function clearImageCache() {
  imageCache.clear();
}
