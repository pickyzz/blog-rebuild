import { Client } from "@notionhq/client";
import { Client as NotionClient } from "@notionhq/client";
import pkg from 'notion-to-md';
const { NotionToMarkdown } = pkg;
import fs from "fs/promises";
import path from "path";
import sharp from "sharp";
import dotenv from "dotenv";

// dotenv.config() will be called in main() with better error handling

// Helper function to ensure valid date
function ensureDate(dateString: any): Date | null {
  if (!dateString) return null;

  try {
    const date = new Date(dateString);
    return isNaN(date.getTime()) ? null : date;
  } catch (error) {
    return null;
  }
}

// Simple rate limiter for Notion API
let lastRequestTime = 0;
const MIN_REQUEST_INTERVAL = 333; // ~3 requests per second (Notion limit is ~5/s)

async function throttleNotion(): Promise<void> {
  const now = Date.now();
  const timeSinceLastRequest = now - lastRequestTime;

  if (timeSinceLastRequest < MIN_REQUEST_INTERVAL) {
    const delay = MIN_REQUEST_INTERVAL - timeSinceLastRequest;
    await new Promise(resolve => setTimeout(resolve, delay));
  }

  lastRequestTime = Date.now();
}

interface SyncConfig {
  notionToken: string;
  databaseId: string;
  contentDir: string;
  publicDir: string;
}

interface NotionPostData {
  id: string;
  title: string;
  slug: string;
  description: string;
  pubDatetime: Date;
  modDatetime?: Date;
  featured: boolean;
  draft: boolean;
  tags: string[];
  author: string;
  readingTime?: string;
  canonicalURL?: string;
  ogImage?: string;
}

class NotionSync {
  private notion: NotionClient;
  private n2m: any;
  private config: SyncConfig;

  constructor(config: SyncConfig) {
    this.config = config;
    this.notion = new NotionClient({
      auth: config.notionToken,
    });
    this.n2m = new NotionToMarkdown({ notionClient: this.notion });

    // Custom transformer for video blocks to render as HTML embed
    // Supports: YouTube, Vimeo, Loom, TikTok, Dailymotion, Twitch, Streamable, Bilibili, Wistia
    this.n2m.setCustomTransformer("video", async (block: any) => {
      const { video } = block;
      const videoUrl = video?.file?.url || video?.external?.url;
      const caption = video?.caption?.[0]?.plain_text || "";

      if (!videoUrl) return "";

      try {
        const url = new URL(videoUrl);
        const hostname = url.hostname.replace(/^www\./, "");

        // YouTube
        if (hostname === "youtube.com" || hostname === "youtu.be") {
          let videoId = "";
          if (hostname === "youtu.be") {
            videoId = url.pathname.slice(1).split("/")[0];
          } else if (url.searchParams.has("v")) {
            videoId = url.searchParams.get("v") || "";
          } else if (url.pathname.startsWith("/embed/")) {
            videoId = url.pathname.replace("/embed/", "").split("/")[0];
          }
          if (videoId && /^[a-zA-Z0-9_-]{11}$/.test(videoId)) {
            return `<figure class="notion-video">
  <iframe width="100%" height="480" src="https://www.youtube.com/embed/${videoId}"
    title="YouTube video player" frameborder="0"
    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
    allowfullscreen></iframe>
  ${caption ? `<figcaption>${caption}</figcaption>` : ""}
</figure>`;
          }
        }

        // Vimeo
        if (hostname === "vimeo.com" || hostname === "player.vimeo.com") {
          let videoId = "";
          if (hostname === "player.vimeo.com") {
            videoId = url.pathname.replace("/video/", "").split("/")[0];
          } else {
            videoId = url.pathname.slice(1).split("/")[0];
          }
          if (videoId && /^\d+$/.test(videoId)) {
            return `<figure class="notion-video">
  <iframe width="100%" height="480" src="https://player.vimeo.com/video/${videoId}"
    title="Vimeo video player" frameborder="0"
    allow="autoplay; fullscreen; picture-in-picture"
    allowfullscreen></iframe>
  ${caption ? `<figcaption>${caption}</figcaption>` : ""}
</figure>`;
          }
        }

        // Loom
        if (hostname === "loom.com" || hostname === "www.loom.com") {
          const shareMatch = url.pathname.match(/\/share\/([a-zA-Z0-9]+)/);
          const embedMatch = url.pathname.match(/\/embed\/([a-zA-Z0-9]+)/);
          const videoId = shareMatch?.[1] || embedMatch?.[1];
          if (videoId) {
            return `<figure class="notion-video">
  <iframe width="100%" height="480" src="https://www.loom.com/embed/${videoId}"
    title="Loom video player" frameborder="0"
    allow="autoplay; fullscreen"
    allowfullscreen></iframe>
  ${caption ? `<figcaption>${caption}</figcaption>` : ""}
</figure>`;
          }
        }

        // TikTok
        if (hostname === "tiktok.com" || hostname.endsWith(".tiktok.com")) {
          const videoMatch = url.pathname.match(/\/video\/(\d+)/);
          if (videoMatch?.[1]) {
            return `<figure class="notion-video">
  <iframe width="100%" height="740" src="https://www.tiktok.com/embed/v2/${videoMatch[1]}"
    title="TikTok video player" frameborder="0"
    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
    allowfullscreen></iframe>
  ${caption ? `<figcaption>${caption}</figcaption>` : ""}
</figure>`;
          }
        }

        // Dailymotion
        if (hostname === "dailymotion.com" || hostname === "dai.ly") {
          let videoId = "";
          if (hostname === "dai.ly") {
            videoId = url.pathname.slice(1);
          } else {
            const match = url.pathname.match(/\/video\/([a-zA-Z0-9]+)/);
            videoId = match?.[1] || "";
          }
          if (videoId) {
            return `<figure class="notion-video">
  <iframe width="100%" height="480" src="https://www.dailymotion.com/embed/video/${videoId}"
    title="Dailymotion video player" frameborder="0"
    allow="autoplay; fullscreen"
    allowfullscreen></iframe>
  ${caption ? `<figcaption>${caption}</figcaption>` : ""}
</figure>`;
          }
        }

        // Twitch (clips and videos)
        if (hostname === "twitch.tv" || hostname === "clips.twitch.tv") {
          let clipId = "";
          let videoId = "";

          // Check for clip URLs
          const clipPathMatch = url.pathname.match(/\/clip\/([a-zA-Z0-9_-]+)/);
          if (clipPathMatch) {
            clipId = clipPathMatch[1];
          } else if (hostname === "clips.twitch.tv") {
            const directClipMatch = url.pathname.match(/\/([a-zA-Z0-9_-]+)/);
            if (directClipMatch) {
              clipId = directClipMatch[1];
            }
          }

          // Check for video URLs
          const videoPathMatch = url.pathname.match(/\/videos\/(\d+)/);
          if (videoPathMatch) {
            videoId = videoPathMatch[1];
          }

          if (clipId) {
            return `<figure class="notion-video">
  <iframe width="100%" height="480" src="https://clips.twitch.tv/embed?clip=${clipId}&parent=${hostname}"
    title="Twitch clip player" frameborder="0"
    allow="autoplay; fullscreen"
    allowfullscreen></iframe>
  ${caption ? `<figcaption>${caption}</figcaption>` : ""}
</figure>`;
          }
          if (videoId) {
            return `<figure class="notion-video">
  <iframe width="100%" height="480" src="https://player.twitch.tv/?video=${videoId}&parent=${hostname}"
    title="Twitch video player" frameborder="0"
    allow="autoplay; fullscreen"
    allowfullscreen></iframe>
  ${caption ? `<figcaption>${caption}</figcaption>` : ""}
</figure>`;
          }
        }

        // Streamable
        if (hostname === "streamable.com") {
          const videoId = url.pathname.slice(1);
          if (videoId) {
            return `<figure class="notion-video">
  <iframe width="100%" height="480" src="https://streamable.com/e/${videoId}"
    title="Streamable video player" frameborder="0"
    allow="autoplay; fullscreen"
    allowfullscreen></iframe>
  ${caption ? `<figcaption>${caption}</figcaption>` : ""}
</figure>`;
          }
        }

        // Bilibili
        if (hostname === "bilibili.com" || hostname === "b23.tv") {
          const bvMatch = url.pathname.match(/\/video\/(BV[a-zA-Z0-9]+)/);
          if (bvMatch?.[1]) {
            return `<figure class="notion-video">
  <iframe width="100%" height="480" src="https://player.bilibili.com/player.html?bvid=${bvMatch[1]}"
    title="Bilibili video player" frameborder="0"
    allow="autoplay; fullscreen"
    allowfullscreen></iframe>
  ${caption ? `<figcaption>${caption}</figcaption>` : ""}
</figure>`;
          }
        }

        // Wistia
        if (hostname === "wistia.com" || hostname.endsWith(".wistia.com")) {
          const mediaMatch = url.pathname.match(/\/medias\/([a-zA-Z0-9]+)/);
          if (mediaMatch?.[1]) {
            return `<figure class="notion-video">
  <iframe width="100%" height="480" src="https://fast.wistia.net/embed/iframe/${mediaMatch[1]}"
    title="Wistia video player" frameborder="0"
    allow="autoplay; fullscreen"
    allowfullscreen></iframe>
  ${caption ? `<figcaption>${caption}</figcaption>` : ""}
</figure>`;
          }
        }

      } catch (e) {
        // Invalid URL, fall back to generic video handling
      }

      // Handle direct video files (mp4, webm, etc.) or unsupported platforms
      return `<figure class="notion-video">
  <video controls width="100%">
    <source src="${videoUrl}" type="video/mp4">
    <source src="${videoUrl}" type="video/webm">
    Your browser does not support the video tag.
  </video>
  ${caption ? `<figcaption>${caption}</figcaption>` : ""}
</figure>`;
    });
  }

  async fetchWithRetry<T>(
    fn: () => Promise<T>,
    maxRetries = 4,
    baseDelay = 1000
  ): Promise<T> {
    let attempt = 0;
    while (true) {
      try {
        await throttleNotion();
        return await fn();
      } catch (error: any) {
        const status = error?.status || error?.code || error?.response?.status;
        const isRetryable =
          status === 429 ||
          (typeof status === "number" && status >= 500 && status < 600);

        if (!isRetryable || attempt >= maxRetries) {
          console.error(`[NOTION API ERROR] Attempt ${attempt + 1}:`, error);
          throw error;
        }

        const delay =
          baseDelay * Math.pow(2, attempt) + Math.floor(Math.random() * 300);
        console.warn(
          `[NOTION API RETRY] Attempt ${attempt + 1} failed (status: ${status}). Retrying in ${delay}ms...`
        );
        await new Promise(res => setTimeout(res, delay));
        attempt++;
      }
    }
  }

  async fetchAllPublishedPosts(): Promise<any[]> {
    const params: any = {
      database_id: this.config.databaseId,
      filter: {
        property: "status",
        select: { equals: "published" },
      },
      sorts: [{ property: "publish_date", direction: "descending" }],
      page_size: 100,
    };

    let allResults: any[] = [];
    while (true) {
      const res = await this.fetchWithRetry(() =>
        this.notion.databases.query(params)
      );
      allResults = allResults.concat(res.results || []);
      if (!res.has_more) break;
      params.start_cursor = res.next_cursor;
    }

    return allResults;
  }

  extractPostData(page: any): NotionPostData {
    const properties = page.properties;

    const title = properties.title?.title?.[0]?.plain_text || "Untitled";
    const rawSlug =
      properties.slug?.rich_text?.[0]?.plain_text ||
      title;
      
    const slug = rawSlug.toLowerCase()
        .replace(/[^\w\s-]/g, "")
        .replace(/\s+/g, "-");
    const description =
      properties.description?.rich_text?.[0]?.plain_text || "";
    const pubDatetimeRaw =
      properties.publish_date?.date?.start || new Date().toISOString();
    const modDatetimeRaw = properties.modified_date?.date?.start;
    const featured =
      properties.featured?.select?.name === "featured" || false;
    const draft = properties.status?.select?.name !== "published";
    const tags =
      properties.tags?.multi_select?.map((tag: any) => tag.name) || [];
    const author = properties.author?.rich_text?.[0]?.plain_text || "Pickyzz";
    const readingTime = properties.readingTime?.rich_text?.[0]?.plain_text;
    const canonicalURL = properties.canonicalURL?.url;

    // Extract ogImage
    let ogImage = undefined;
    const possibleImageProps = [
      "ogImage",
      "og_image",
      "cover",
      "image",
      "header_image",
      "thumbnail",
    ];

    for (const propName of possibleImageProps) {
      if (properties[propName]?.files?.[0]) {
        const file = properties[propName].files[0];
        ogImage = file.type === "external" ? file.external.url : file.file.url;
        break;
      }
    }

    if (!ogImage && page.cover) {
      if (page.cover.type === "external") {
        ogImage = page.cover.external.url;
      } else if (page.cover.type === "file") {
        ogImage = page.cover.file.url;
      }
    }

    return {
      id: page.id,
      slug,
      title,
      description,
      pubDatetime: ensureDate(pubDatetimeRaw) ?? new Date(),
      modDatetime: ensureDate(modDatetimeRaw) ?? undefined,
      featured,
      draft,
      tags,
      author,
      readingTime,
      canonicalURL,
      ogImage,
    };
  }

  async downloadImage(url: string, filename: string): Promise<string> {
    try {
      const imagePath = path.join(this.config.publicDir, "images", "blog", filename);

      // Check if image already exists
      try {
        await fs.access(imagePath);
        // console.log(`⏭️  Skipping existing image: ${filename}`);
        return `/images/blog/${filename}`;
      } catch {
        // File doesn't exist, proceed with download
      }

      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Failed to fetch image: ${response.statusText}`);
      }

      const buffer = await response.arrayBuffer();

      // Ensure directory exists
      await fs.mkdir(path.dirname(imagePath), { recursive: true });
      await fs.writeFile(imagePath, new Uint8Array(buffer));

      console.log(`✅ Downloaded image: ${filename}`);

      // Generate placeholder after download
      await this.generatePlaceholder(imagePath);

      return `/images/blog/${filename}`;
    } catch (error) {
      console.warn(`Failed to download image ${url}:`, error);
      return url; // Return original URL if download fails
    }
  }

  async generatePlaceholder(imagePath: string): Promise<string | null> {
    try {
      const nameWithoutExt = path.parse(imagePath).name;
      const placeholderPath = path.join(path.dirname(imagePath), `${nameWithoutExt}.placeholder.jpg`);

      // Check if placeholder already exists
      try {
        await fs.access(placeholderPath);
        return `/images/blog/${path.basename(placeholderPath)}`;
      } catch {
        // Placeholder doesn't exist, create it
      }

      // Create a small blurred version (20px width, maintain aspect ratio)
      await sharp(imagePath)
        .resize(20, null, {
          kernel: sharp.kernel.lanczos3,
          withoutEnlargement: true
        })
        .blur(2)
        .jpeg({
          quality: 60,
          progressive: true
        })
        .toFile(placeholderPath);

      console.log(`✅ Generated placeholder: ${path.basename(placeholderPath)}`);
      return `/images/blog/${path.basename(placeholderPath)}`;
    } catch (error) {
      console.warn(`Failed to generate placeholder for ${imagePath}:`, error);
      return null;
    }
  }



  async convertToMarkdown(pageId: string): Promise<string> {
    const mdBlocks = await this.n2m.pageToMarkdown(pageId);
    const mdString = this.n2m.toMarkdownString(mdBlocks);
    return mdString.parent;
  }

  async processContentImages(content: string, slug: string): Promise<string> {
    // Process both markdown images and HTML img tags
    const patterns = [
      /!\[.*?\]\((https:\/\/[^)]+)\)/g, // Markdown images
      /<img[^>]+src="(https:\/\/[^"]+)"[^>]*>/g, // HTML img tags
    ];

    const imageUrls: string[] = [];
    let imageCounter = 1;

    // Extract all image URLs
    patterns.forEach(pattern => {
      let match;
      while ((match = pattern.exec(content)) !== null) {
        imageUrls.push(match[1]);
      }
    });

    // Remove duplicates while preserving order
    const uniqueUrls = [...new Set(imageUrls)];

    for (const imageUrl of uniqueUrls) {
      try {
        const url = new URL(imageUrl);
        const extension = path.extname(url.pathname) || ".jpg";
        // Simple sequential naming: slug-content-1.jpg, slug-content-2.jpg, etc.
        const filename = `${slug}-content-${imageCounter}${extension}`;
        imageCounter++;

        const localPath = await this.downloadImage(imageUrl, filename);
        content = content.replace(new RegExp(imageUrl.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), localPath);
      } catch (error) {
        console.warn(`Failed to process image ${imageUrl}:`, error);
      }
    }

    return content;
  }

  async generateFrontmatter(postData: NotionPostData): Promise<string> {
    const frontmatter: any = {
      notionId: postData.id, // Store Notion page ID for content fetching
      title: postData.title,
      description: postData.description,
      pubDatetime: postData.pubDatetime, // Date object for Astro
      featured: postData.featured,
      draft: postData.draft,
      tags: postData.tags,
      author: postData.author,
    };

    if (postData.modDatetime) {
      frontmatter.modDatetime = postData.modDatetime; // Date object for Astro
    }
    if (postData.readingTime) {
      frontmatter.readingTime = postData.readingTime;
    }
    if (postData.canonicalURL) {
      frontmatter.canonicalURL = postData.canonicalURL;
    }
    if (postData.ogImage) {
      // Always download ogImage if it's an external URL
      if (postData.ogImage.startsWith('http')) {
        try {
          const extension = path.extname(new URL(postData.ogImage).pathname) || '.jpg';
          // Use slug as filename for ogImage
          const filename = `${postData.slug}${extension}`;
          const localPath = await this.downloadImage(postData.ogImage, filename);
          frontmatter.ogImage = localPath;
        } catch (error) {
          console.warn(`Failed to download ogImage for ${postData.slug}:`, error);
          frontmatter.ogImage = "/pickyzz-og.png"; // Fallback to default image
        }
      } else {
        frontmatter.ogImage = postData.ogImage;
      }
    }

    // Helper function to escape YAML string values
    const escapeYamlString = (str: string): string => {
      // If string contains special characters, wrap in quotes and escape internal quotes
      if (/[:\n\r"'#\[\]{}!&*?|><%@`]/.test(str) || str.trim() !== str) {
        return `"${str.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n')}"`;
      }
      return `"${str}"`;
    };

    // Helper function to format frontmatter values
    const formatValue = (key: string, value: any): string => {
      if (Array.isArray(value)) {
        return `${key}: [${value.map(v => escapeYamlString(String(v))).join(", ")}]`;
      }
      if (value instanceof Date) {
        return `${key}: ${value.toISOString()}`;
      }
      if (typeof value === "string") {
        return `${key}: ${escapeYamlString(value)}`;
      }
      return `${key}: ${value}`;
    };

    const frontmatterStr = Object.entries(frontmatter)
      .map(([key, value]) => formatValue(key, value))
      .join("\n");

    return `---
${frontmatterStr}
---
`;
  }

  async syncPost(page: any): Promise<void> {
    try {
      const postData = this.extractPostData(page);
      const markdownContent = await this.convertToMarkdown(page.id);
      const processedContent = await this.processContentImages(markdownContent, postData.slug);
      const frontmatter = await this.generateFrontmatter(postData);

      const fullContent = `${frontmatter}\n\n${processedContent}`;
      const filePath = path.join(this.config.contentDir, `${postData.slug}.md`);

      await fs.writeFile(filePath, fullContent, "utf-8");
      console.log(`✅ Synced post: ${postData.title} (${postData.slug})`);
    } catch (error) {
      console.error(`❌ Failed to sync post ${page.id}:`, error);
    }
  }

  async ensureDirectories(): Promise<void> {
    try {
      // Ensure content directory exists
      await fs.mkdir(this.config.contentDir, { recursive: true });

      // Ensure blog images directory exists
      const blogImagesPath = path.join(this.config.publicDir, "images", "blog");
      await fs.mkdir(blogImagesPath, { recursive: true });

      console.log("📁 Verified directories exist");
    } catch (error) {
      console.warn("Failed to ensure directories:", error);
    }
  }

  async generateSearchData(posts: any[]): Promise<void> {
    try {
      // Transform posts to search format
      const searchData = posts.map(post => ({
        id: post.id,
        slug: post.slug,
        title: post.title,
        description: post.description,
        pubDatetime: post.pubDatetime.toISOString(),
        tags: post.tags,
        author: post.author,
      }));

      // Write search data to public/data/search.json
      const searchDataPath = path.join(this.config.publicDir, "data", "search.json");
      await fs.mkdir(path.dirname(searchDataPath), { recursive: true });
      await fs.writeFile(searchDataPath, JSON.stringify(searchData, null, 2), "utf-8");

      console.log(`🔍 Generated search data for ${searchData.length} posts`);
    } catch (error) {
      console.warn("⚠️ Failed to generate search data:", error);
    }
  }

  async generateAllPlaceholders(): Promise<void> {
    try {
      const blogImagesPath = path.join(this.config.publicDir, "images", "blog");
      const files = await fs.readdir(blogImagesPath);

      console.log("🔄 Generating placeholder images...");

      for (const file of files) {
        if (file.match(/\.(png|jpg|jpeg|webp|avif)$/i) && !file.includes('.placeholder')) {
          const fullPath = path.join(blogImagesPath, file);
          await this.generatePlaceholder(fullPath);
        }
      }

      console.log("✅ All placeholders generated successfully!");
    } catch (error) {
      console.warn("⚠️ Failed to generate placeholders:", error);
    }
  }

  async sync(): Promise<void> {
    console.log("🚀 Starting Notion sync (Full Rebuild)...");

    try {
      // Ensure directories exist without deleting them
      await this.ensureDirectories();

      // Fetch all published posts
      console.log("📥 Fetching posts from Notion...");
      const pages = await this.fetchAllPublishedPosts();
      console.log(`Found ${pages.length} published posts`);

      // Extract post data for search generation
      const postsData = pages.map(page => this.extractPostData(page));

      // Sync each post
      for (const page of pages) {
        await this.syncPost(page);
      }

      // Generate placeholders for all downloaded images
      await this.generateAllPlaceholders();

      // Generate static search data
      await this.generateSearchData(postsData);

      console.log("✅ Full rebuild sync completed successfully!");
    } catch (error) {
      console.error("❌ Sync failed:", error);
      throw error;
    }
  }
}

// Main execution
async function main() {
  // Auto-load environment variables with fallback to different .env locations
  const envPaths = [
    path.resolve(process.cwd(), ".env"),
    path.resolve(process.cwd(), ".env.local"),
    path.resolve(process.cwd(), ".env.development"),
  ];

  let envLoaded = false;
  for (const envPath of envPaths) {
    try {
      const result = dotenv.config({ path: envPath });
      if (result.parsed) {
        console.log(`📄 Loaded environment from: ${path.basename(envPath)}`);
        envLoaded = true;
        break;
      }
    } catch (error: any) {
      // Continue trying other env files
    }
  }

  const config: SyncConfig = {
    notionToken: process.env.NOTION_KEY || "",
    databaseId: process.env.DATABASE_ID || "",
    contentDir: path.resolve(process.cwd(), "src/content/blog"),
    publicDir: path.resolve(process.cwd(), "public"),
  };

  if (!config.notionToken || !config.databaseId) {
    console.error("\n❌ Missing required environment variables:");
    if (!config.notionToken) console.log("   - NOTION_KEY");
    if (!config.databaseId) console.log("   - DATABASE_ID");

    if (!envLoaded) {
      console.log("\n📝 Environment files checked (not found):");
      envPaths.forEach(p => console.log(`   - ${p}`));
      console.log("\n💡 Solution:");
      console.log("   1. Copy .example.env to .env");
      console.log("   2. Add your Notion credentials to .env");
      console.log("   3. Run the script again");
    }
    process.exit(1);
  }

  console.log("✅ Environment variables loaded successfully");

  const sync = new NotionSync(config);
  await sync.sync();
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}

export default NotionSync;
