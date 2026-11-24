import { pageHead } from "../../../src/seo/meta";
import { BOT_NAME } from "../../../src/site";

export const aboutBotHead = pageHead({
  title: `Our crawler (${BOT_NAME})`,
  description: `Identity, robots.txt compliance, rate limits and opt-out instructions for ${BOT_NAME}, the seeds.hues.flowers crawler.`,
  path: "/about/bot",
});
