import { slugifyStr } from "@utils/slugify";
import Datetime from "./Datetime";
import type { CollectionEntry } from "astro:content";

export interface Props {
  href?: string;
  frontmatter: CollectionEntry<"blog">["data"];
  secHeading?: boolean;
}

export default function Card({ href, frontmatter, secHeading = true }: Props) {
  const { title, pubDatetime, modDatetime, description, ogImage } = frontmatter;

  const headerProps = {
    style: { viewTransitionName: slugifyStr(title) },
    className:
      "my-4 h-14 text-skin-accent text-center text-lg font-medium decoration-dashed line-clamp-2",
  };

  return (
    <li className="my-6 max-h-[350px]">
      <a
        id="card-url"
        href={href}
        rel="prefetch"
        className="decoration-dashed underline-offset-4 focus-visible:no-underline focus-visible:underline-offset-0"
      >
        <div className="flex-shrink-0 object-cover overflow-hidden rounded-lg">
          <img
            className="card-animate duration-200 h-[12rem] md:h-[10rem] w-[100vw] object-cover object-center"
            src={ogImage}
            loading="eager"
            alt=""
          />
        </div>
        {secHeading ? (
          <h2 {...headerProps}>{title}</h2>
        ) : (
          <h3 {...headerProps}>{title}</h3>
        )}
        <p className="h-[3rem] mb-4 text-center line-clamp-2">{description}</p>
      </a>
      <Datetime pubDatetime={pubDatetime} modDatetime={modDatetime} />
    </li>
  );
}
