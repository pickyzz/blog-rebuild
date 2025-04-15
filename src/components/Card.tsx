import { slugifyStr } from "@/utils/slugify";
import { Datetime } from "./Datetime";
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
      "text-white text-[1.1rem] text-center text-lg font-light decoration-dashed",
  };

  return (
    <li className="my-6 max-h-[350px]">
      <a
        id="card-url"
        href={href}
        rel="prefetch"
        className="decoration-dashed underline-offset-4 focus-visible:no-underline focus-visible:underline-offset-0"
      >
        <div className="relative mb-4 flex-shrink-0 overflow-hidden rounded-lg object-cover">
          <img
            className="card-animate h-[13rem] w-[100vw] scale-125 object-cover object-center duration-500 hover:scale-110 md:scale-100"
            src={ogImage?.src}
            loading="eager"
            alt=""
          />
          <div className="absolute bottom-0 left-0 right-0 flex min-h-[35%] items-center justify-center bg-black/75 px-10 py-2">
            {secHeading ? (
              <h2 {...headerProps}>{title}</h2>
            ) : (
              <h3 {...headerProps}>{title}</h3>
            )}
          </div>
        </div>
        <p className="mb-4 line-clamp-2 h-[3rem] text-center text-base">
          {description}
        </p>
      </a>
      <Datetime
        pubDatetime={pubDatetime}
        modDatetime={modDatetime}
        className="justify-center"
      />
    </li>
  );
}
