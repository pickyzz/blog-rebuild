import Datetime from "./Datetime";
import type { BlogFrontmatter } from "@content/_schemas";

export interface Props {
  href?: string;
  frontmatter: BlogFrontmatter;
  secHeading?: boolean;
}

export default function Card({ href, frontmatter, secHeading = true }: Props) {
  const { title, pubDatetime, description, ogImage } = frontmatter;
  return (
    <li className="my-6">
      <a
        href={href}
        rel="prefetch"
        className="inline-block text-lg font-medium text-skin-accent decoration-dashed underline-offset-4 focus-visible:no-underline focus-visible:underline-offset-0"
      >
        <img
          className="h-[10rem] w-[100vw] overflow-hidden rounded-lg object-cover object-center"
          src={ogImage}
          loading="lazy"
          alt=""
        />
        {secHeading ? (
          <h2 className="my-4 h-14 text-center text-lg font-medium decoration-dashed line-clamp-2 hover:underline">
            {title}
          </h2>
        ) : (
          <h3 className="my-4 h-14 text-center text-lg font-medium decoration-dashed line-clamp-2 hover:underline">
            {title}
          </h3>
        )}
      </a>
      <p className="mb-4 text-center line-clamp-2">{description}</p>
      <Datetime datetime={pubDatetime} />
    </li>
  );
}
