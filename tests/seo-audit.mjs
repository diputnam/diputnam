// Post-build audit of search/social metadata and crawl-surface files (see openspec
// seo-geo-foundation): every indexable page carries one h1, a sized title/description,
// robots, a complete Open Graph/Twitter set with an existing 1200×630 image, valid
// JSON-LD with Organization/WebSite/page type (NewsArticle on notes), and linked icons;
// robots.txt, sitemap.xml, llms.txt, 404.html, vercel.json agree with what dist/ holds.
import { readdir, readFile, stat } from 'node:fs/promises';
import { join, relative } from 'node:path';

const dist = process.env.DIST_DIR ?? 'dist';
const SITE = 'https://www.diputnam.com';
const failures = [];
const fail = (message) => failures.push(message);

const walk = async (dir) => {
  const entries = await readdir(dir, { withFileTypes: true });
  return (await Promise.all(entries.map((entry) => (entry.isDirectory() ? walk(join(dir, entry.name)) : join(dir, entry.name))))).flat();
};
const exists = (path) => stat(path).then(() => true, () => false);
// og:image is served from the deploy host (see ASSET_ORIGIN in src/lib/seo.ts), not necessarily SITE.
const assetOrigin = (process.env.PUBLIC_ASSET_ORIGIN || (process.env.VERCEL_PROJECT_PRODUCTION_URL && `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`) || SITE).replace(/\/$/, '');
const localPath = (url) => (url.startsWith(`${assetOrigin}/`) ? join(dist, url.slice(assetOrigin.length + 1)) : null);
const pngSize = async (path) => { const buf = await readFile(path); return buf.toString('ascii', 1, 4) === 'PNG' ? [buf.readUInt32BE(16), buf.readUInt32BE(20)] : null; };
const meta = (html, attr, name) => html.match(new RegExp(`<meta ${attr}="${name}" content="([^"]*)"`))?.[1];
const decode = (text) => text.replaceAll('&amp;', '&').replaceAll('&lt;', '<').replaceAll('&gt;', '>').replaceAll('&quot;', '"').replaceAll('&#39;', "'");
const length = (text) => [...decode(text)].length;

const files = await walk(dist);
const htmlFiles = files.filter((file) => file.endsWith('.html'));
const routeOf = (file) => '/' + relative(dist, file).replace(/index\.html$/, '');
const indexable = new Set();

for (const file of htmlFiles) {
  const html = await readFile(file, 'utf8');
  const name = relative(dist, file);
  const route = routeOf(file);
  const isNota = /^\/(?:noticias|en\/news)\/[^/]+\/$/.test(route);
  const noindex = /<meta name="robots" content="noindex/.test(html);
  const robots = meta(html, 'name', 'robots');
  if (!robots) fail(`${name}: missing <meta name="robots">`);

  if (noindex) {
    if (name !== '404.html') fail(`${name}: unexpected noindex`);
  } else {
    indexable.add(route);
    if (!robots?.includes('max-image-preview:large')) fail(`${name}: robots lacks max-image-preview:large`);
    const h1s = html.match(/<h1[\s>]/g) ?? [];
    if (h1s.length !== 1) fail(`${name}: expected one <h1>, found ${h1s.length}`);
    const title = html.match(/<title>([^<]*)<\/title>/)?.[1] ?? '';
    const titleLength = length(title);
    if (titleLength < 30 || titleLength > 60) fail(`${name}: <title> is ${titleLength} chars (30–60): ${decode(title)}`);
    if (!decode(title).includes('Putnam')) fail(`${name}: <title> does not name the brand`);
    const description = meta(html, 'name', 'description') ?? '';
    const descriptionLength = length(description);
    if (descriptionLength < 110 || descriptionLength > 155) fail(`${name}: description is ${descriptionLength} chars (110–155)`);

    for (const property of ['og:type', 'og:site_name', 'og:locale', 'og:url', 'og:title', 'og:description', 'og:image', 'og:image:width', 'og:image:height', 'og:image:alt', 'og:image:type']) {
      if (meta(html, 'property', property) === undefined) fail(`${name}: missing ${property}`);
    }
    for (const property of ['twitter:card', 'twitter:title', 'twitter:description', 'twitter:image']) {
      if (meta(html, 'name', property) === undefined) fail(`${name}: missing ${property}`);
    }
    if (meta(html, 'name', 'twitter:card') !== 'summary_large_image') fail(`${name}: twitter:card is not summary_large_image`);
    if (meta(html, 'property', 'og:url') !== `${SITE}${route}`) fail(`${name}: og:url is ${meta(html, 'property', 'og:url')}`);
    if (meta(html, 'property', 'og:type') !== (isNota ? 'article' : 'website')) fail(`${name}: og:type is ${meta(html, 'property', 'og:type')}`);
    const ogImage = meta(html, 'property', 'og:image') ?? '';
    if (!/^https:\/\//.test(ogImage)) fail(`${name}: og:image is not absolute: ${ogImage}`);
    const local = localPath(ogImage);
    if (local) {
      if (!(await exists(local))) fail(`${name}: og:image ${ogImage} is missing from dist/`);
      else { const size = await pngSize(local); if (!size || size[0] !== 1200 || size[1] !== 630) fail(`${name}: og:image ${ogImage} is ${size?.join('×') ?? 'not a PNG'} (expected 1200×630)`); }
    } else if (!ogImage.startsWith('https://cdn.sanity.io/')) fail(`${name}: og:image on an unexpected host: ${ogImage}`);
    if (isNota) for (const property of ['article:published_time', 'article:modified_time', 'article:section']) {
      if (!meta(html, 'property', property)) fail(`${name}: missing ${property}`);
    }

    const blocks = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map(([, json]) => json);
    if (blocks.length !== 1) fail(`${name}: expected one JSON-LD block, found ${blocks.length}`);
    for (const json of blocks) {
      let graph;
      try { graph = JSON.parse(json)['@graph']; } catch (error) { fail(`${name}: JSON-LD does not parse (${error.message})`); continue; }
      if (!Array.isArray(graph)) { fail(`${name}: JSON-LD has no @graph`); continue; }
      const types = graph.map((node) => node['@type']);
      if (graph.some((node) => !node['@type'])) fail(`${name}: JSON-LD node without @type`);
      for (const type of ['Organization', 'WebSite']) if (!types.includes(type)) fail(`${name}: JSON-LD lacks ${type}`);
      if (!types.some((type) => ['WebPage', 'AboutPage', 'ContactPage', 'CollectionPage'].includes(type))) fail(`${name}: JSON-LD lacks a page type`);
      if (route !== '/' && route !== '/en/' && !types.includes('BreadcrumbList')) fail(`${name}: JSON-LD lacks BreadcrumbList`);
      const article = graph.find((node) => node['@type'] === 'NewsArticle');
      if (isNota && !article) fail(`${name}: JSON-LD lacks NewsArticle`);
      if (article) for (const field of ['datePublished', 'dateModified']) {
        if (!/^\d{4}-\d{2}-\d{2}/.test(article[field] ?? '')) fail(`${name}: NewsArticle.${field} is not ISO 8601`);
      }
    }
  }

  for (const href of ['/favicon.ico', '/favicon.svg', '/apple-touch-icon.png', '/site.webmanifest']) {
    if (!html.includes(`href="${href}"`)) fail(`${name}: does not link ${href}`);
    else if (!(await exists(join(dist, href.slice(1))))) fail(`${name}: linked ${href} is missing from dist/`);
  }
}

// Site-level files.
const read = async (file) => ((await exists(join(dist, file))) ? readFile(join(dist, file), 'utf8') : (fail(`missing ${file}`), ''));
const robots = await read('robots.txt');
if (robots && !robots.includes(`Sitemap: ${SITE}/sitemap.xml`)) fail('robots.txt: missing Sitemap line');
if (/^Disallow:\s*\/\S*/m.test(robots)) fail('robots.txt: has a Disallow rule');

const sitemap = await read('sitemap.xml');
const locs = new Set([...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map(([, loc]) => loc.replace(SITE, '')));
for (const route of indexable) if (!locs.has(route)) fail(`sitemap.xml: missing ${route}`);
for (const loc of locs) if (!indexable.has(loc)) fail(`sitemap.xml: lists ${loc}, which is not an indexable page in dist/`);
for (const [, block] of sitemap.matchAll(/<url>([\s\S]*?)<\/url>/g)) {
  const loc = block.match(/<loc>([^<]+)<\/loc>/)?.[1];
  if (!/<xhtml:link rel="alternate" hreflang="x-default"/.test(block)) fail(`sitemap.xml: ${loc} lacks x-default`);
  for (const [, href] of block.matchAll(/hreflang="[^"]+" href="([^"]+)"/g)) if (!locs.has(href.replace(SITE, ''))) fail(`sitemap.xml: ${loc} alternates to unlisted ${href}`);
}

const llms = await read('llms.txt');
if (llms && !llms.startsWith('# Putnam')) fail('llms.txt: does not start with "# Putnam"');
for (const route of ['/', '/eredita/', '/putnam/', '/noticias/', '/unete/', '/contacto/', '/en/', '/en/eredita/', '/en/putnam/', '/en/news/', '/en/join/', '/en/contact/']) {
  if (llms && !llms.includes(`(${SITE}${route})`)) fail(`llms.txt: does not link ${route}`);
}
for (const route of indexable) if (llms && /^\/(?:noticias|en\/news)\/[^/]+\/$/.test(route) && !llms.includes(`${SITE}${route}`)) fail(`llms.txt: does not list note ${route}`);
for (const route of indexable) if (llms && /^\/(?:en\/)?eredita\/[^/]+\/$/.test(route) && !llms.includes(`(${SITE}${route})`)) fail(`llms.txt: does not list project ${route}`);

const notFound = await read('404.html');
if (notFound && !/<meta name="robots" content="noindex/.test(notFound)) fail('404.html: not noindex');
if (notFound && !/lang="en"/.test(notFound)) fail('404.html: no English block');

const vercel = JSON.parse(await readFile(new URL('../vercel.json', import.meta.url), 'utf8').catch(() => '{}'));
const astroCache = (vercel.headers ?? []).find((rule) => rule.source.startsWith('/_astro/'))?.headers?.find((h) => h.key === 'Cache-Control')?.value ?? '';
if (!/max-age=31536000, immutable/.test(astroCache)) fail('vercel.json: /_astro/* is not immutable');
await read('site.webmanifest');

if (failures.length) {
  console.error(`seo-audit: ${failures.length} problem(s) in ${dist}/`);
  for (const failure of failures) console.error(`  - ${failure}`);
  process.exit(1);
}
console.log(`seo-audit: ${indexable.size} indexable page(s) OK — titles, descriptions, Open Graph, JSON-LD, icons, robots.txt, sitemap.xml, llms.txt, 404.html, vercel.json.`);
