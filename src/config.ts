import type { SocialObjects } from "./types";

export const SITE = {
  website: "https://pickyzz.dev/",
  author: "Parinya T.",
  profile: "https://pickyzz.dev/about/",
  desc: "Just a pieces of code",
  title: "Pickyzz",
  ogImage: "pickyzz-og.png",
  lightAndDarkMode: true,
  postOnIndex: 4,
  postPerPage: 8,
  scheduledPostMargin: 15 * 60 * 1000, // 15 minutes
  showArchives: true,
};

export const LOGO_IMAGE = {
  enable: false,
  svg: true,
  width: 36,
  height: 36,
};

export const SOCIALS: SocialObjects = [
  {
    name: "Github",
    href: "https://github.com/pickyzz",
    linkTitle: ` ${SITE.title} on Github`,
    active: true,
    scheduledPostMargin: 0
  },
  {
    name: "Facebook",
    href: "https://www.facebook.com/iiipik",
    linkTitle: `${SITE.title} on Facebook`,
    active: false,
    scheduledPostMargin: 0
  },
  {
    name: "Instagram",
    href: "https://www.instagram.com/p1ckyzz",
    linkTitle: `${SITE.title} on Instagram`,
    active: true,
    scheduledPostMargin: 0
  },
  {
    name: "LinkedIn",
    href: "https://github.com/pickyzz",
    linkTitle: `${SITE.title} on LinkedIn`,
    active: false,
    scheduledPostMargin: 0
  },
  {
    name: "Mail",
    href: "mailto:contact@pickyzz.dev",
    linkTitle: `Send an email to ${SITE.title}`,
    active: true,
    scheduledPostMargin: 0
  },
  {
    name: "Twitter",
    href: "https://twitter.com/P1ckyzz",
    linkTitle: `${SITE.title} on Twitter`,
    active: false,
    scheduledPostMargin: 0
  },
  {
    name: "Twitch",
    href: "https://twitter.com/P1ckyzz",
    linkTitle: `${SITE.title} on Twitch`,
    active: false,
    scheduledPostMargin: 0
  },
  {
    name: "YouTube",
    href: "https://twitter.com/P1ckyzz",
    linkTitle: `${SITE.title} on YouTube`,
    active: false,
    scheduledPostMargin: 0
  },
  {
    name: "WhatsApp",
    href: "https://twitter.com/P1ckyzz",
    linkTitle: `${SITE.title} on WhatsApp`,
    active: false,
    scheduledPostMargin: 0
  },
  {
    name: "Snapchat",
    href: "https://twitter.com/P1ckyzz",
    linkTitle: `${SITE.title} on Snapchat`,
    active: false,
    scheduledPostMargin: 0
  },
  {
    name: "Pinterest",
    href: "https://twitter.com/P1ckyzz",
    linkTitle: `${SITE.title} on Pinterest`,
    active: false,
    scheduledPostMargin: 0
  },
  {
    name: "TikTok",
    href: "https://twitter.com/P1ckyzz",
    linkTitle: `${SITE.title} on TikTok`,
    active: false,
    scheduledPostMargin: 0
  },
  {
    name: "CodePen",
    href: "https://twitter.com/P1ckyzz",
    linkTitle: `${SITE.title} on CodePen`,
    active: false,
    scheduledPostMargin: 0
  },
  {
    name: "Discord",
    href: "https://twitter.com/P1ckyzz",
    linkTitle: `${SITE.title} on Discord`,
    active: false,
    scheduledPostMargin: 0
  },
  {
    name: "GitLab",
    href: "https://twitter.com/P1ckyzz",
    linkTitle: `${SITE.title} on GitLab`,
    active: false,
    scheduledPostMargin: 0
  },
  {
    name: "Reddit",
    href: "https://twitter.com/P1ckyzz",
    linkTitle: `${SITE.title} on Reddit`,
    active: false,
    scheduledPostMargin: 0
  },
  {
    name: "Skype",
    href: "https://twitter.com/P1ckyzz",
    linkTitle: `${SITE.title} on Skype`,
    active: false,
    scheduledPostMargin: 0
  },
  {
    name: "Steam",
    href: "https://twitter.com/P1ckyzz",
    linkTitle: `${SITE.title} on Steam`,
    active: false,
    scheduledPostMargin: 0
  },
  {
    name: "Telegram",
    href: "https://twitter.com/P1ckyzz",
    linkTitle: `${SITE.title} on Telegram`,
    active: false,
    scheduledPostMargin: 0
  },
  {
    name: "Mastodon",
    href: "https://twitter.com/P1ckyzz",
    linkTitle: `${SITE.title} on Mastodon`,
    active: false,
    scheduledPostMargin: 0
  },
  {
    name: "Feed",
    href: "/feed",
    linkTitle: `${SITE.title} on Feed`,
    active: true,
    scheduledPostMargin: 0
  },
];
