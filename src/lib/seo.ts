// Search and social metadata derived from the route, the language and the CMS: absolute
// URLs, Open Graph, structured data. SiteHead.astro is the only consumer; views pass
// `page`/`kind`/`article` and never assemble tags themselves.
import { pages, t, type Lang, type PageKey } from '../i18n';
import type { Settings } from './content';

export const SITE = 'https://www.diputnam.com';
export const SITE_NAME = 'Putnam';

export const absolute = (path: string) => new URL(path, SITE).toString();

// Origin the social cover is fetched from. Canonical URLs stay on SITE, but WhatsApp/
// Facebook download og:image at share time, so it must be a host that resolves today:
// Vercel's production URL (the *.vercel.app name until the custom domain is attached,
// then the domain itself). `PUBLIC_ASSET_ORIGIN` overrides it; local builds use SITE.
const productionHost = process.env.VERCEL_PROJECT_PRODUCTION_URL && `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
export const ASSET_ORIGIN = (process.env.PUBLIC_ASSET_ORIGIN || productionHost || SITE).replace(/\/$/, '');
export const asset = (path: string) => (/^https?:\/\//.test(path) ? path : new URL(path, ASSET_ORIGIN).toString());

// Facebook's code for Latin American Spanish; X and LinkedIn ignore unknown locales.
export const ogLocale = (lang: Lang) => (lang === 'es' ? 'es_LA' : 'en_US');

// Cuts at a word boundary so `text + suffix` never exceeds `max` characters.
export const truncate = (text: string, max: number, suffix = '') => {
  const room = max - suffix.length;
  if (text.length <= room) return `${text}${suffix}`;
  const cut = text.slice(0, room - 1);
  const atWord = cut.slice(0, cut.lastIndexOf(' ') > 0 ? cut.lastIndexOf(' ') : cut.length);
  return `${atWord.replace(/[\s,;:.·|-]+$/, '')}…${suffix}`;
};

export type PageType = 'WebPage' | 'AboutPage' | 'ContactPage' | 'CollectionPage';
export const pageTypeOf = (page: PageKey): PageType => ({ home: 'WebPage', eredita: 'WebPage', putnam: 'AboutPage', noticias: 'CollectionPage', unete: 'WebPage', contacto: 'ContactPage' } as const)[page];

export interface ArticleMeta { headline: string; published: string; modified: string; section: string; image: string; imageAlt: string }
export interface JsonLdInput { lang: Lang; page: PageKey; url: string; title: string; description: string; pageType: PageType; settings: Settings; article?: ArticleMeta; breadcrumbTitle?: string }

const ORG_ID = `${SITE}/#organization`;
const SITE_ID = `${SITE}/#website`;

// Everything sits in one @graph: Organization and WebSite are stable across pages (same
// @id), the page node and, for notes, the NewsArticle reference them.
export const jsonLd = ({ lang, page, url, title, description, pageType, settings, article, breadcrumbTitle }: JsonLdInput) => {
  const ui = t(lang);
  const org = settings.organization;
  const logo = absolute(org.logo ?? '/icons/icon-512.png');
  const organization: Record<string, unknown> = {
    '@type': 'Organization', '@id': ORG_ID, name: SITE_NAME, url: `${SITE}/`,
    logo: { '@type': 'ImageObject', url: logo },
    description: org.description,
    address: { '@type': 'PostalAddress', streetAddress: settings.address, addressLocality: settings.city.split(',')[0].trim(), addressCountry: 'BO' },
    contactPoint: { '@type': 'ContactPoint', telephone: settings.phone, email: settings.email, contactType: 'sales', availableLanguage: ['es', 'en'] },
  };
  if (org.legalName) organization.legalName = org.legalName;
  if (org.foundingYear) organization.foundingDate = String(org.foundingYear);
  if (settings.coordinates) organization.geo = { '@type': 'GeoCoordinates', latitude: settings.coordinates.lat, longitude: settings.coordinates.lng };
  if (org.sameAs.length) organization.sameAs = org.sameAs;

  const website = { '@type': 'WebSite', '@id': SITE_ID, url: `${SITE}/`, name: SITE_NAME, inLanguage: ['es', 'en'], publisher: { '@id': ORG_ID } };

  const crumbs: { name: string; item: string }[] = [{ name: ui.nav.home, item: absolute(pages.home[lang]) }];
  if (page !== 'home') crumbs.push({ name: ui.nav[page], item: absolute(pages[page][lang]) });
  if (breadcrumbTitle) crumbs.push({ name: breadcrumbTitle, item: url });
  const breadcrumb = crumbs.length > 1 ? {
    '@type': 'BreadcrumbList', '@id': `${url}#breadcrumb`,
    itemListElement: crumbs.map((crumb, index) => ({ '@type': 'ListItem', position: index + 1, name: crumb.name, item: crumb.item })),
  } : null;

  const webpage: Record<string, unknown> = {
    '@type': pageType, '@id': url, url, name: title, description, inLanguage: lang,
    isPartOf: { '@id': SITE_ID }, about: { '@id': ORG_ID },
  };
  if (breadcrumb) webpage.breadcrumb = { '@id': breadcrumb['@id'] };

  const graph: unknown[] = [organization, website, webpage];
  if (breadcrumb) graph.push(breadcrumb);
  if (article) graph.push({
    '@type': 'NewsArticle', headline: article.headline, description,
    datePublished: article.published, dateModified: article.modified, inLanguage: lang,
    image: { '@type': 'ImageObject', url: article.image, width: 1200, height: 630, caption: article.imageAlt },
    articleSection: article.section,
    // Name repeated so validators that do not resolve @id still see an author.
    author: { '@type': 'Organization', '@id': ORG_ID, name: SITE_NAME }, publisher: { '@type': 'Organization', '@id': ORG_ID, name: SITE_NAME },
    mainEntityOfPage: { '@id': url },
  });
  return { '@context': 'https://schema.org', '@graph': graph };
};

// `</script>` inside JSON would end the tag early; escaping `<` keeps the JSON valid.
export const jsonLdScript = (graph: unknown) => JSON.stringify(graph).replaceAll('<', '\\u003c');
