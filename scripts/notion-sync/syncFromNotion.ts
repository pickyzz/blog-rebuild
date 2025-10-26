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
    const slug =
      properties.slug?.rich_text?.[0]?.plain_text ||
      title.toLowerCase()
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
      modDatetime: ensureDate(modDatetimeRaw),
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
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Failed to fetch image: ${response.statusText}`);
      }

      const buffer = await response.arrayBuffer();

      // Ensure directory exists
      await fs.mkdir(path.dirname(imagePath), { recursive: true });
      await fs.writeFile(imagePath, Buffer.from(buffer));

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

  // Helper function to format frontmatter values
  const formatValue = (key: string, value: any): string => {
    if (Array.isArray(value)) {
      return `${key}: [${value.map(v => `"${v}"`).join(", ")}]`;
    }
    if (value instanceof Date) {
      return `${key}: ${value.toISOString()}`;
    }
    return `${key}: ${typeof value === "string" ? `"${value}"` : value}`;
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

  async fullRebuild(): Promise<void> {
    try {
      // Delete and recreate content directory
      const contentPath = this.config.contentDir;
      await fs.rm(contentPath, { recursive: true, force: true });
      await fs.mkdir(contentPath, { recursive: true });
      console.log("🧹 Rebuilt content directory");

      // Backup static images before clearing
      const staticImages = [
        'static/profile.jpg',
        'static/fcc-cert-1.png',
        'static/fcc-cert-2.png',
        'static/fcc-cert-3.png'
      ];
      const tempDir = path.join(this.config.publicDir, "images", "..", "temp_static");

      try {
        await fs.mkdir(tempDir, { recursive: true });

        // Backup static images
        for (const img of staticImages) {
          const srcPath = path.join(this.config.publicDir, "images", img);
          const destPath = path.join(tempDir, path.basename(img));
          try {
            await fs.copyFile(srcPath, destPath);
            console.log(`📦 Backed up ${img}`);
          } catch (error) {
            console.log(`⚠️  ${img} not found, skipping backup`);
          }
        }

        // Delete and recreate blog images directory only
        const blogImagesPath = path.join(this.config.publicDir, "images", "blog");
        await fs.rm(blogImagesPath, { recursive: true, force: true });
        await fs.mkdir(blogImagesPath, { recursive: true });
        console.log("🧹 Rebuilt blog images directory");

        // Ensure static directory exists before restoring
        const staticDir = path.join(this.config.publicDir, "images", "static");
        await fs.mkdir(staticDir, { recursive: true });

        // Restore static images
        for (const img of staticImages) {
          const srcPath = path.join(tempDir, path.basename(img));
          const destPath = path.join(this.config.publicDir, "images", img);
          try {
            await fs.copyFile(srcPath, destPath);
            console.log(`📦 Restored ${img}`);
          } catch (error) {
            console.log(`⚠️  Failed to restore ${img}`);
          }
        }

        // Clean up temp directory
        await fs.rm(tempDir, { recursive: true, force: true });
        console.log("📦 Cleaned up temporary files");

      } catch (error) {
        console.warn("Error during static image backup/restore:", error);
        // Ensure temp directory is cleaned up even if errors occur
        try {
          await fs.rm(tempDir, { recursive: true, force: true });
        } catch (cleanupError) {
          // Ignore cleanup errors
        }
      }
    } catch (error) {
      console.warn("Failed to perform full rebuild:", error);
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
      // Full rebuild - delete and recreate directories
      await this.fullRebuild();

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
