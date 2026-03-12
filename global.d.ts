declare module "pdfjs-dist/*";
declare module "*.mjs?url";
declare module "*.png" {
  import type { StaticImageData } from "next/image";

  const src: StaticImageData;
  export default src;
}
