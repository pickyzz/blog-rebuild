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
  const { title, pubDatetime, description, ogImage } = frontmatter;

  const headerProps = {
    style: { viewTransitionName: slugifyStr(title) },
    className:
      "my-4 h-14 text-center text-lg font-medium decoration-dashed line-clamp-2 hover:underline",
  };

  return (
    <li className="my-6">
      <a
        href={href}
        rel="prefetch"
        className="inline-block text-lg font-medium text-skin-accent decoration-dashed underline-offset-4 focus-visible:no-underline focus-visible:underline-offset-0"
      >
        <img
          className="animate__animated animate__fadeIn animate__slow h-[10rem] w-[100vw] overflow-hidden rounded-lg object-cover object-center"
          src={ogImage}
          loading="lazy"
          alt=""
        />
        {secHeading ? (
          <h2 {...headerProps}>{title}</h2>
        ) : (
          <h3 {...headerProps}>{title}</h3>
        )}
      </a>
      <p className="mb-4 line-clamp-2 text-center">{description}</p>
      <Datetime datetime={pubDatetime} />
    </li>
  );
}
