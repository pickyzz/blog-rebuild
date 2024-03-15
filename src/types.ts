import type socialIcons from "@assets/socialIcons";

export type Site = {
  website: string;
  author: string;
  profile: string;
  desc: string;
  title: string;
  ogImage?: string;
  lightAndDarkMode: boolean;
  postOnIndex: number;
  postPerPage: number;
};

export type SocialObjects = {
  name: keyof typeof socialIcons;
  href: string;
  active: boolean;
  linkTitle: string;
  scheduledPostMargin: number;
}[];
