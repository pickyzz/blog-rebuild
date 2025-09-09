import path from "path";
import imageType from "image-type";
import crypto from "crypto";
import fs from "fs";

const IMAGE_PATH = `src/assets/images/blog`;

// IMPORTANT: This bit is required to allow dynamic importing of images via Astro & Vite
// postImageImport allows dynamically import images from local filesystem via Vite with variable names
export async function postImageImport(imageFileName) {
  // Image paths must be relative, and end with file extension to work in Vite build process
  // See https://github.com/rollup/plugins/tree/master/packages/dynamic-import-vars#meta
  const filename = path.parse(imageFileName);
  const name = filename.name;
  const ext = filename.ext;

  if (!name) {
    console.warn("No image, skipping", imageFileName);
    return;
  }

  try {
    switch (ext) {
      case ".webp":
        return await import(`../assets/images/blog/${name}.webp`);
      case ".jpg":
        return await import(`../assets/images/blog/${name}.jpg`);
      case ".png":
        return await import(`../assets/images/blog/${name}.png`);
      case ".svg":
        return await import(`../assets/images/blog/${name}.svg`);
      case ".gif":
        return await import(`../assets/images/blog/${name}.gif`);
      case ".avif":
        return await import(`../assets/images/blog/${name}.avif`);
      case ".jpeg":
        return await import(`../assets/images/blog/${name}.jpeg`);
      case ".bmp":
        return await import(`../assets/images/blog/${name}.bmp`);
      case ".tiff":
        return await import(`../assets/images/blog/${name}.tiff`);
      case ".ico":
        return await import(`../assets/images/blog/${name}.ico`);
      default:
        return await import(`../assets/images/blog/${name}.jpg`);
    }
  } catch (error) {
    console.error(`Failed to import image: ${imageFileName}`, error);
    return null;
  }

  /*
  The returned imported image results are in this format:

  {
    default: {
      src: '/@fs/Users/json/Projects/astronot/src/assets/images/blog/4f9edb242363447c8ed31c88e86fcb1766a93d2b938bf25c2528d52da4dc478b-cover.jpg?origWidth=1500&origHeight=1397&origFormat=jpg',
      width: 1500,
      height: 1397,
      format: 'jpg',
      orientation: 1
    },
    [Symbol(Symbol.toStringTag)]: 'Module'
  }
  */
}

export function hashString(data) {
  const hash = crypto.createHash("sha256");
  hash.update(data);
  return hash.digest("hex");
}

export async function downloadImage(
  imageUrl,
  {
    isCover = false, // Notion Cover image, displays at top of posts
  }
) {
  try {
    if (typeof imageUrl !== "string" || !/^https?:\/\/.+/.test(imageUrl)) {
      throw new Error("Invalid imageUrl: must be a valid http(s) URL string");
    }
    const response = await fetch(imageUrl);
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const { ext } = await imageType(buffer);

    if (!ext) {
      throw new Error("Cannot determine image type");
    }

    const fileHash = hashString(imageUrl).slice(0, 10);
    const dirPath = `${process.cwd()}/${IMAGE_PATH}`;
    const fileName = `${dirPath}/${fileHash}${isCover ? "-cover" : ""}.${ext}`;
    // console.log("Hashed Filename:", fileName);

    // Ensure directory exists
    await fs.promises.mkdir(dirPath, { recursive: true });

    await fs.promises.writeFile(fileName, buffer);
    const relativePath = path.relative(process.cwd(), fileName);
    console.info(`Image downloaded: ${relativePath}`);

    return fileName;
  } catch (error) {
    console.error(
      `Failed to download or save image from URL: ${imageUrl}\nTarget path: ${process.cwd()}/${IMAGE_PATH}\nError:`,
      error
    );
    return null;
  }
}
// Generate responsive image attributes for <img> tag
export function generateResponsiveImageAttrs({ src, formats = ["webp", "jpeg"], widths = [400, 800, 1200, 1400], sizes = "100vw", alt = "", loading = "lazy", decoding = "async", fetchpriority = "auto", className = "" }) {
  // src: base filename without extension, e.g. "cover"
  // formats: preferred formats, e.g. ["webp", "jpeg"]
  // widths: responsive widths
  // sizes: sizes attribute for <img>
  // Returns: { srcset, sizes, type, ... }
  const srcset = formats.map(format =>
    `${widths.map(w => `/assets/images/blog/${src}-${w}.${format} ${w}w`).join(", ")}`
  ).join(", ");
  const type = formats[0] === "webp" ? "image/webp" : `image/${formats[0]}`;
  return {
    src: `/assets/images/blog/${src}-${widths[widths.length - 1]}.${formats[formats.length - 1]}`,
    srcset,
    sizes,
    type,
    alt,
    loading,
    decoding,
    fetchpriority,
    className
  };
}
