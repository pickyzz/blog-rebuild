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
      "text-white/85 text-[1.1rem] text-center text-lg font-light decoration-dashed",
  };

  return (
    <li className="my-6 max-h-[350px]">
      <a
        id="card-url"
        href={href}
        rel="prefetch"
        className="decoration-dashed underline-offset-4 focus-visible:no-underline focus-visible:underline-offset-0"
      >
        <div className="relative flex-shrink-0 object-cover mb-4 overflow-hidden rounded-lg">
          <img
            className="card-animate duration-500 h-[13rem] w-[100vw] object-cover object-center"
            src={ogImage?.src}
            loading="eager"
            alt=""
          />
          <div className="absolute bottom-0 left-0 right-0 flex items-center justify-center px-10 py-2 bg-black/75 min-h-[35%]">
            {secHeading ? (
              <h2 {...headerProps}>{title}</h2>
            ) : (
              <h3 {...headerProps}>{title}</h3>
            )}
          </div>
        </div>
        <p className="h-[3rem] mb-4 text-center line-clamp-2">{description}</p>
      </a>
      <Datetime pubDatetime={pubDatetime} modDatetime={modDatetime} className="justify-center" />
    </li>
  );
}
