export interface BlogPost {
  id: string;
  slug: string;
  data: {
    title: string;
    description: string;
    pubDatetime: Date;
    modDatetime?: Date;
    featured: boolean;
    draft: boolean;
    tags: string[];
    author: string;
    readingTime?: string;
    canonicalURL?: string;
    ogImage?: {
      src: string;
      width: number;
      height: number;
      format: 'png' | 'jpg' | 'jpeg' | 'webp';
    };
  };
  body: string;
  collection: string;
  render: () => Promise<{ Content: any }>;
}