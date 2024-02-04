import "animate.css";
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
      "my-4 h-14 text-center text-lg font-medium decoration-dashed line-clamp-2 hover:underline",
  };

  return (
    <li className="my-6">
      <a
        id="card-url"
        href={href}
        rel="prefetch"
        className="inline-block text-lg font-medium text-skin-accent decoration-dashed underline-offset-4 focus-visible:no-underline focus-visible:underline-offset-0"
      >
        <div className="rounded-lg object-cover flex-shrink-0 overflow-hidden">
          <img
            className="card-animate duration-200 h-[10rem] w-[100vw] object-cover object-center"
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
      </a>
      <p className="mb-4 line-clamp-2 text-center">{description}</p>
      <Datetime pubDatetime={pubDatetime} modDatetime={modDatetime} />
    </li>
  );
}
