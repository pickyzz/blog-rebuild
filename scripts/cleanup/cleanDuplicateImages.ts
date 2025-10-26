import fs from "fs/promises";
import path from "path";
import crypto from "crypto";

interface ImageInfo {
  path: string;
  basename: string;
  extension: string;
  slug: string;
  hash?: string;
  timestamp?: number;
  isOgImage: boolean;
}

async function analyzeImages(imagesDir: string): Promise<ImageInfo[]> {
  const files = await fs.readdir(imagesDir);
  const images: ImageInfo[] = [];

  for (const file of files) {
    if (!file.match(/\.(png|jpg|jpeg|gif|webp|avif)$/)) continue;

    const fullPath = path.join(imagesDir, file);
    const ext = path.extname(file);
    const basename = path.basename(file, ext);
    const stat = await fs.stat(fullPath);

    // Parse different naming patterns
    let slug: string;
    let hash: string | undefined;
    let timestamp: number | undefined;
    let isOgImage = false;

    // Pattern: slug-hash.ext
    let hashMatch = basename.match(/^([a-zA-Z0-9-]+)-([a-f0-9]{12})$/);
    if (hashMatch) {
      slug = hashMatch[1];
      hash = hashMatch[2];
      isOgImage = false;
    }
    // Pattern: slug-og-hash.ext
    else if ((hashMatch = basename.match(/^([a-zA-Z0-9-]+)-og-([a-f0-9]{12})$/))) {
      slug = hashMatch[1];
      hash = hashMatch[2];
      isOgImage = true;
    }
    // Pattern: slug-hash-timestamp.ext (old pattern)
    else if ((hashMatch = basename.match(/^([a-zA-Z0-9-]+)-([a-zA-Z0-9]{8})-(\d+)$/))) {
      slug = hashMatch[1];
      hash = hashMatch[2];
      timestamp = parseInt(hashMatch[3]);
      isOgImage = false;
    }
    // Pattern: slug-og-timestamp.ext (old pattern)
    else if ((hashMatch = basename.match(/^([a-zA-Z0-9-]+)-og-(\d+)$/))) {
      slug = hashMatch[1];
      timestamp = parseInt(hashMatch[2]);
      isOgImage = true;
    }
    // Pattern: profile.jpg (special case)
    else if (basename === 'profile') {
      slug = 'profile';
      isOgImage = false;
    }
    // Pattern: fcc-cert-N.ext (special case)
    else if ((hashMatch = basename.match(/^fcc-cert-(\d)$/))) {
      slug = `fcc-cert-${hashMatch[1]}`;
      isOgImage = false;
    }
    else {
      slug = basename; // Fallback
      isOgImage = false;
    }

    images.push({
      path: fullPath,
      basename,
      extension: ext,
      slug,
      hash,
      timestamp,
      isOgImage,
    });
  }

  return images;
}

function groupImagesByType(images: ImageInfo[]) {
  const groups: Map<string, ImageInfo[]> = new Map();

  for (const image of images) {
    if (image.slug === 'profile' || image.slug.startsWith('fcc-cert')) {
      // Keep special images as is
      const key = image.basename;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(image);
      continue;
    }

    // Group by slug + hash + og status
    const key = `${image.slug}-${image.hash || 'unknown'}${image.isOgImage ? '-og' : ''}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(image);
  }

  return groups;
}

async function selectBestImage(group: ImageInfo[]): Promise<ImageInfo> {
  // Prefer images with consistent hash (new format) over timestamped ones
  const consistentHash = group.find(img => img.hash && img.hash.length === 12 && !img.timestamp);
  if (consistentHash) return consistentHash;

  // Fallback to newest timestamped image
  return group.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0))[0];
}

async function main() {
  const imagesDir = path.resolve(process.cwd(), "public/images");

  console.log("🔍 Analyzing images in:", imagesDir);

  const images = await analyzeImages(imagesDir);
  console.log(`📊 Found ${images.length} images`);

  const groups = groupImagesByType(images);
  console.log(`📦 Grouped into ${groups.size} unique image groups`);

  let totalDuplicates = 0;
  let totalSizeSaved = 0;

  for (const [key, group] of groups) {
    if (group.length <= 1) continue;

    totalDuplicates += group.length - 1;

    // Select best image to keep
    const bestImage = await selectBestImage(group);
    const imagesToDelete = group.filter(img => img !== bestImage);

    console.log(`\n📁 Group: ${key} (${group.length} images)`);
    console.log(`   Keeping: ${bestImage.basename}`);

    for (const image of imagesToDelete) {
      try {
        const stat = await fs.stat(image.path);
        totalSizeSaved += stat.size;

        await fs.unlink(image.path);
        console.log(`   ❌ Deleted: ${image.basename}`);
      } catch (error) {
        console.warn(`   ⚠️  Failed to delete ${image.basename}:`, error);
      }
    }
  }

  console.log(`\n✅ Cleanup completed!`);
  console.log(`   🗑️  Deleted ${totalDuplicates} duplicate images`);
  console.log(`   💾 Saved ${(totalSizeSaved / 1024 / 1024).toFixed(2)} MB`);

  // Show remaining images
  const remainingImages = await fs.readdir(imagesDir);
  const imageCount = remainingImages.filter(f => f.match(/\.(png|jpg|jpeg|gif|webp|avif)$/)).length;
  console.log(`   📸 ${imageCount} images remaining`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}
