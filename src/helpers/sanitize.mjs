import sanitizeHtml from "sanitize-html";

export function sanitize(html) {
  // Robust XSS sanitizer using sanitize-html library
  if (typeof html !== "string") return "";
  return sanitizeHtml(html, {
    allowedTags: [
      "b",
      "i",
      "em",
      "strong",
      "a",
      "ul",
      "ol",
      "li",
      "p",
      "br",
      "span",
      "div",
      "img",
      "blockquote",
      "pre",
      "code",
      "hr",
      "h1",
      "h2",
      "h3",
      "h4",
      "h5",
      "h6",
      "iframe",
      "button",
      "figcaption",
    ],
    allowedAttributes: {
      a: ["href", "name", "target", "rel"],
      img: ["src", "alt", "title", "width", "height", "data-large", "data-src"],
      iframe: [
        "src",
        "width",
        "height",
        "frameborder",
        "allow",
        "allowfullscreen",
      ],
      button: ["class", "onclick", "aria-label", "data-*"],
      "*": ["style", "class", "data-language", "data-*"],
    },
    allowedSchemes: ["http", "https", "mailto"],
    allowProtocolRelative: false,
    allowedIframeHostnames: ["www.youtube.com", "youtube.com", "youtu.be"],
    transformTags: {
      iframe: function (tagName, attribs) {
        let src = attribs.src || "";
        if (
          src.startsWith("https://www.youtube.com/embed/") ||
          src.startsWith("https://youtube.com/embed/") ||
          src.startsWith("https://youtu.be/embed/")
        ) {
          // Only allow safe attributes on allowed YouTube iframes
          return {
            tagName: "iframe",
            attribs: {
              src: src,
              width: attribs.width || "560",
              height: attribs.height || "315",
              frameborder: attribs.frameborder || "0",
              allow:
                attribs.allow ||
                "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture",
              allowfullscreen: "true",
            },
          };
        }
        // All other iframes removed
        return { tagName: "", text: "" };
      },
    },
  });
}

export function sanitizeUrl(str) {
  return str
    .toLowerCase() // convert to lowercase
    .replace(/[^a-z0-9]+/g, "-") // replace non-alphanumeric characters with hyphens
    .replace(/(^-|-$)+/g, ""); // remove leading/trailing hyphens
}

export function sanitizeImageString(str) {
  return str.replace(/[^a-zA-Z]/g, "").toLowerCase();
}
