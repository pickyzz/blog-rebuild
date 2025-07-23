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
    default:
      return await import(`../assets/images/blog/${name}.jpg`);
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
  const response = await fetch(imageUrl);
  const arrayBuffer = await response.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  const { ext, mime } = await imageType(buffer);

  const fileHash = hashString(imageUrl);
  const fileName = `${process.cwd()}/${IMAGE_PATH}/${fileHash}${
    isCover ? "-cover" : ""
  }.${ext}`;
  // console.log("Hashed Filename:", fileName);

  fs.writeFileSync(fileName, buffer);
  const shortName = path.basename(fileName);
  console.info(`Image downloaded: ${shortName} (${mime})`);

  return fileName;
}
