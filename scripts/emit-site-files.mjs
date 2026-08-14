// Emits domain-correct robots.txt and sitemap.xml into dist/ at build time.
//
// The committed templates in public/ keep the legacy fallback domain so the
// project works without configuration, but production deployments should set
// SITE_URL (or VITE_SITE_URL) in Netlify so crawlers are pointed at the real
// production domain instead of the template placeholder.

import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const fallback = "https://safepay-app.lovable.app";
const siteUrl = (process.env.SITE_URL || process.env.VITE_SITE_URL || fallback).replace(/\/+$/, "");

const validOrigin = /^https?:\/\/[^/]+\/?$/.test(siteUrl + "/") || siteUrl.length > 0;
const base = validOrigin ? siteUrl : fallback;

const robots = await readFile(path.join(root, "public", "robots.txt"), "utf8");
const robotsWithSitemap = robots.includes("Sitemap:")
  ? robots.replace(/^Sitemap:.*$/m, `Sitemap: ${base}/sitemap.xml`)
  : `${robots.trimEnd()}\n\nSitemap: ${base}/sitemap.xml\n`;
await writeFile(path.join(root, "dist", "robots.txt"), robotsWithSitemap);

const sitemap = await readFile(path.join(root, "public", "sitemap.xml"), "utf8");
const rewritten = sitemap.replace(/<loc>(https?:\/\/[^<]+)<\/loc>/g, (_m, url) => {
  const schemeEnd = url.indexOf("://") + 3;
  const firstSlash = url.indexOf("/", schemeEnd);
  const pagePath = firstSlash === -1 ? "/" : url.slice(firstSlash);
  return `<loc>${base}${pagePath}</loc>`;
});
await writeFile(path.join(root, "dist", "sitemap.xml"), rewritten);

console.log(`[emit-site-files] wrote dist/robots.txt and dist/sitemap.xml using site URL ${base}`);
