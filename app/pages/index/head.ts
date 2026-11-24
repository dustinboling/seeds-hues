import { pageHead } from "../../src/seo/meta";
import { SITE_DESCRIPTION, SITE_TITLE } from "../../src/site";

export const homeHead = pageHead({
  title: SITE_TITLE,
  absoluteTitle: true,
  description: SITE_DESCRIPTION,
  path: "/",
});
