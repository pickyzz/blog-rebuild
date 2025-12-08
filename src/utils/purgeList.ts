import fs from "fs";
import path from "path";

const OUT_FILE = path.resolve(process.cwd(), "dist", "purge-urls.json");

export function addPurgeUrl(url: string) {
  try {
    const dir = path.dirname(OUT_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    let arr: string[] = [];
    if (fs.existsSync(OUT_FILE)) {
      try {
        const raw = fs.readFileSync(OUT_FILE, "utf8");
        arr = JSON.parse(raw);
        if (!Array.isArray(arr)) arr = [];
      } catch (e) {
        arr = [];
      }
    }
    if (!arr.includes(url)) {
      arr.push(url);
      fs.writeFileSync(OUT_FILE, JSON.stringify(arr, null, 2), "utf8");
    }
  } catch (e) {
    // best-effort: do not throw during build
    try {
      console.warn("[PURGE LIST] failed to write purge list", String(e));
    } catch (_) {}
  }
}

export function readPurgeUrls(): string[] {
  try {
    if (fs.existsSync(OUT_FILE)) {
      const raw = fs.readFileSync(OUT_FILE, "utf8");
      const arr = JSON.parse(raw);
      if (Array.isArray(arr)) return arr;
    }
  } catch (e) {}
  return [];
}
