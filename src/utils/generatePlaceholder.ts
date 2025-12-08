import sharp from "sharp";

const PLACEHOLDER_WIDTH = parseInt(process.env.IMAGE_PLACEHOLDER_WIDTH || "32");
const PLACEHOLDER_QUALITY = parseInt(
  process.env.IMAGE_PLACEHOLDER_QUALITY || "30"
);

/**
 * สร้าง LQIP (Low Quality Image Placeholder) จาก URL หรือ buffer
 * @param input - URL ของรูปหรือ buffer
 * @returns data-uri string (base64 webp) หรือ null ถ้าล้มเหลว
 */
export async function generatePlaceholder(
  input: string | Buffer
): Promise<string | null> {
  try {
    let buffer: Buffer;

    if (typeof input === "string") {
      // Fetch image from URL (assume it's already validated/allowed)
      const res = await fetch(input);
      if (!res.ok) return null;
      const arr = await res.arrayBuffer();
      buffer = Buffer.from(arr);
    } else {
      buffer = input;
    }

    // Generate tiny placeholder
    const placeholder = await sharp(buffer)
      .resize({ width: PLACEHOLDER_WIDTH, fit: "inside" })
      .webp({ quality: PLACEHOLDER_QUALITY })
      .toBuffer();

    // Convert to data-uri
    const base64 = placeholder.toString("base64");
    return `data:image/webp;base64,${base64}`;
  } catch (err) {
    console.warn("[PLACEHOLDER] generation failed:", String(err));
    return null;
  }
}
