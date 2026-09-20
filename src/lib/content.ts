// Every query the site runs, one function per page. Localized fields are resolved in
// GROQ (`coalesce(field[$lang], field.es)`) so views receive plain, already-localized
// values and never branch on language.
import { sanityFetch } from './sanity.ts';
import type { Lang } from '../i18n/routes.ts';

export interface CmsImage { url: string; width: number; height: number; alt: string; decorative: boolean; crop?: { top: number; bottom: number; left: number; right: number }; hotspot?: { x: number; y: number; width: number; height: number } }
export interface Pair { label: string; value: string }
export interface Titled { title: string; text: string }
export interface Heading { kicker: string; title: string; text?: string }

// `lang` is one of the two route-table locales, so it is interpolated as a literal:
// `coalesce(field.en, field.es)` for English, `field.es` for Spanish.
const projections = (lang: Lang) => {
  const loc = (path: string) => (lang === 'es' ? `${path}.es` : `coalesce(${path}.en, ${path}.es)`);
  const l = (field: string) => `"${field}": ${loc(field)}`;
  const img = (field: string) => `"${field}": ${field}{ "url": asset->url, "width": asset->metadata.dimensions.width, "height": asset->metadata.dimensions.height, crop, hotspot, ${l('alt')}, decorative }`;
  const heading = (extra = '') => `${l('kicker')}, ${l('title')}, ${l('text')}${extra ? `, ${extra}` : ''}`;
  const pairs = (field: string) => `"${field}": ${field}[]{ ${l('label')}, ${l('value')} }`;
  const titled = (field: string) => `"${field}": ${field}[]{ ${l('title')}, ${l('text')} }`;
  const strings = (field: string) => `"${field}": ${field}[]{ "v": ${loc('@')} }.v`;
  return { l, img, heading, pairs, titled, strings };
};

export interface Organization { description: string; legalName: string | null; foundingYear: number | null; sameAs: string[]; logo: string | null }
export interface Settings { city: string; email: string; phone: string; whatsapp: string; whatsappNumber: string; address: string; hours: string; hoursShort: string; responseTime: string; mapsUrl: string; coordinates: { lat: number; lng: number }; organization: Organization }
export const getSettings = async (lang: Lang): Promise<Settings> => {
  const { l } = projections(lang);
  const s = await sanityFetch<Omit<Settings, 'whatsapp' | 'whatsappNumber' | 'organization'> & { whatsappMessage: string; organization: Partial<Organization> | null }>(`*[_id == "siteSettings"][0]{ city, email, phone, ${l('whatsappMessage')}, address, ${l('hours')}, ${l('hoursShort')}, responseTime, mapsUrl, coordinates,
    organization{ ${l('description')}, legalName, foundingYear, "sameAs": coalesce(sameAs, []), "logo": logo.asset->url } }`, { lang });
  if (!s) throw new Error('Sanity: siteSettings is missing (run the seed)');
  const whatsappNumber = s.phone.replace(/\D/g, '');
  const organization: Organization = { description: '', legalName: null, foundingYear: null, sameAs: [], logo: null, ...s.organization };
  return { ...s, organization, whatsappNumber, whatsapp: `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(s.whatsappMessage ?? '')}` };
};

export interface SocialLink { kind: 'whatsapp' | 'facebook' | 'instagram'; url: string }
// WhatsApp always comes from `contact.whatsapp`; Facebook/Instagram are recognized by
// domain from `organization.sameAs` (already an editable CMS field) — no new field needed.
export const socialLinks = (contact: Settings): SocialLink[] => {
  const links: SocialLink[] = [{ kind: 'whatsapp', url: contact.whatsapp }];
  for (const url of contact.organization.sameAs) {
    if (/(^|\.)facebook\.com$/.test(new URL(url).hostname)) links.push({ kind: 'facebook', url });
    else if (/(^|\.)instagram\.com$/.test(new URL(url).hostname)) links.push({ kind: 'instagram', url });
  }
  return links;
};

// Last publish time of a singleton, for sitemap lastmod (a build date would be a lie).
export const getUpdatedAt = (id: string) => sanityFetch<string | null>(`*[_id == $id][0]._updatedAt`, { id });

export interface HomeScene { id: 'inicio' | 'eredita' | 'putnam' | 'contacto'; title: string; image: CmsImage; video: string | null }
export const getHome = (lang: Lang) => { const { l, img } = projections(lang); return sanityFetch<{ scenes: HomeScene[] }>(`*[_id == "home"][0]{ scenes[]{ id, ${l('title')}, ${img('image')}, "video": video.asset->url } }`, { lang }); };

// Ereditá is a line of buildings: the singleton is its landing page, each `proyecto`
// carries the commercial content and its own route.
export interface Eredita {
  hero: { kicker: string; title: string; sub: string; poster: CmsImage; video: string | null };
  intro: { kicker: string; title: string; lead: string; bullets: string[]; facts: Pair[] };
  projects: Heading;
  cta: Heading;
}
const erediteHero = (lang: Lang) => { const { l, img } = projections(lang); return `hero{ ${l('kicker')}, ${l('title')}, ${l('sub')}, ${img('poster')}, "video": video.asset->url }`; };
const erediteIntro = (lang: Lang) => { const { l, pairs, strings } = projections(lang); return `intro{ ${l('kicker')}, ${l('title')}, ${l('lead')}, ${strings('bullets')}, ${pairs('facts')} }`; };
export const getEredita = (lang: Lang) => { const { heading } = projections(lang); return sanityFetch<Eredita>(`*[_id == "eredita"][0]{
  ${erediteHero(lang)}, ${erediteIntro(lang)},
  projects{ ${heading()} },
  cta{ ${heading()} }
}`, { lang }); };

export interface ProyectoCard { id: string; name: string; slug: string; order: number; status: string | null; card: { image: CmsImage; text: string }; updatedAt: string }
const proyectoCard = (lang: Lang) => { const { l, img } = projections(lang); return `"id": _id, name, "slug": slug.current, order, ${l('status')}, card{ ${img('image')}, ${l('text')} }, "updatedAt": _updatedAt`; };
// Published projects in landing order; also the source of the static project routes.
export const getProyectos = (lang: Lang) => sanityFetch<ProyectoCard[]>(`*[_type == "proyecto" && defined(slug.current)] | order(order asc){ ${proyectoCard(lang)} }`, { lang });

// A typology's media, in the editor's order: any mix of videos and renders.
export type TypologyMedia =
  | { kind: 'video'; src: string; poster: CmsImage; caption: string | null }
  | { kind: 'image'; image: CmsImage; caption: string | null };
export type GalleryMedia =
  | { kind: 'video'; src: string; poster: CmsImage; tag: string }
  | { kind: 'image'; image: CmsImage; tag: string };
export interface Typology { id: string; tag: string; tone: string; title: string; subtitle: string; media: TypologyMedia[]; description: string; specs: Pair[] }
export interface Proyecto extends ProyectoCard {
  hero: Eredita['hero'];
  intro: Eredita['intro'];
  gallery: Heading & { items: GalleryMedia[] };
  typologies: Heading & { intro: string; items: Typology[] };
  legal: { kicker: string; title: string; lead: string };
  cta: Heading;
}
export const getProyecto = async (lang: Lang, slug: string): Promise<Proyecto | null> => {
  const { l, img, heading, pairs } = projections(lang);
  type Raw = Omit<Proyecto, 'typologies'> & { typologies: Omit<Proyecto['typologies'], 'items'> & { items: (Omit<Typology, 'media'> & { images: TypologyMedia[] })[] } };
  const raw = await sanityFetch<Raw | null>(`*[_type == "proyecto" && slug.current == $slug][0]{
    ${proyectoCard(lang)},
    ${erediteHero(lang)}, ${erediteIntro(lang)},
    gallery{ ${heading()}, "items": coalesce(items[]{ "kind": select(defined(video.asset) => "video", "image"), ${img('image')}, "src": video.asset->url, "poster": image{ "url": asset->url, "width": asset->metadata.dimensions.width, "height": asset->metadata.dimensions.height, crop, hotspot, ${l('alt')}, decorative }, ${l('tag')} }, []) },
    typologies{ ${heading(l('intro'))}, "items": coalesce(items[]{ "id": id.current, ${l('tag')}, tone, ${l('title')}, ${l('subtitle')}, ${l('description')}, ${pairs('specs')},
      "images": coalesce(images[]{
        "kind": select(_type == "typologyVideo" => "video", "image"),
        _type == "typologyVideo" => { "src": video.asset->url, ${img('poster')}, ${l('caption')} },
        _type == "captionedImage" => { "image": { "url": asset->url, "width": asset->metadata.dimensions.width, "height": asset->metadata.dimensions.height, crop, hotspot, ${l('alt')}, decorative }, ${l('caption')} }
      }, []) }, []) },
    legal{ ${l('kicker')}, ${l('title')}, ${l('lead')} },
    cta{ ${heading()} }
  }`, { lang, slug });
  if (!raw) return null;
  if (slug === 'eredita-art') console.log('DEBUG gallery kinds', lang, JSON.stringify(raw.gallery.items.map((i) => i.kind)));
  const items = raw.typologies.items.map(({ images, ...rest }) => ({ ...rest, media: images }));
  return { ...raw, typologies: { ...raw.typologies, items } };
};

export interface LegalDoc { title: string; description: string; file: { url: string; size: number } | null; version: string | null; validFrom: string | null }
// Documents common to the line (no project reference) plus the ones tied to `projectId`.
export const getLegalDocs = (lang: Lang, projectId: string) => { const { l } = projections(lang); return sanityFetch<LegalDoc[]>(`*[_type == "documentoLegal" && (!defined(proyecto) || proyecto._ref == $projectId)] | order(order asc){ ${l('title')}, ${l('description')}, "file": select(defined(file.asset) => { "url": file.asset->url, "size": file.asset->size }, null), version, validFrom }`, { lang, projectId }); };

export interface Putnam {
  hero: { kicker: string; title: string; lead: string; image: CmsImage; video: string | null };
  process: { kicker: string; steps: { number: string; title: string; text: string; image: CmsImage | null }[] };
  principles: Heading & { mission: Pair & { text: string; title: string }; vision: Pair & { text: string; title: string }; valuesLabel: string; valuesTitle: string; values: string[] };
  differences: Heading & { items: { number: string; title: string; text: string }[] };
  cta: Heading;
}
export const getPutnam = (lang: Lang) => { const { l, img, heading, strings } = projections(lang); return sanityFetch<Putnam>(`*[_id == "putnam"][0]{
  hero{ ${l('kicker')}, ${l('title')}, ${l('lead')}, ${img('image')}, "video": video.asset->url },
  process{ ${l('kicker')}, steps[]{ number, ${l('title')}, ${l('text')}, ${img('image')} } },
  principles{ ${heading()}, mission{ ${l('label')}, ${l('title')}, ${l('text')} }, vision{ ${l('label')}, ${l('title')}, ${l('text')} }, ${l('valuesLabel')}, ${l('valuesTitle')}, ${strings('values')} },
  differences{ ${heading()}, items[]{ number, ${l('title')}, ${l('text')} } },
  cta{ ${heading()} }
}`, { lang }); };

export interface Unete {
  hero: { kicker: string; title: string; lead: string; meta: string[]; image: CmsImage; video: string | null };
  culture: Heading & { traits: Titled[] };
  profile: Heading & { values: Titled[]; kpis: Pair[] };
  openings: Heading & { emptyKicker: string; emptyTitle: string; emptyText: string[]; cta: string };
  process: Heading & { steps: Titled[] };
  spontaneous: Heading & { fields: string[] };
  apply: Heading;
  mail: { body: string; whatsapp: string };
}
export const getUnete = (lang: Lang) => { const { l, img, heading, pairs, titled, strings } = projections(lang); return sanityFetch<Unete>(`*[_id == "unete"][0]{
  hero{ ${l('kicker')}, ${l('title')}, ${l('lead')}, ${strings('meta')}, ${img('image')}, "video": video.asset->url },
  culture{ ${heading()}, ${titled('traits')} },
  profile{ ${heading()}, ${titled('values')}, ${pairs('kpis')} },
  openings{ ${heading()}, ${l('emptyKicker')}, ${l('emptyTitle')}, ${strings('emptyText')}, ${l('cta')} },
  process{ ${heading()}, ${titled('steps')} },
  spontaneous{ ${heading()}, ${strings('fields')} },
  apply{ ${heading()} },
  mail{ ${l('body')}, ${l('whatsapp')} }
}`, { lang }); };

export interface Contacto {
  hero: { kicker: string; title: string; lead: string; image: CmsImage; video: string | null };
  channels: Heading & { kpis: { value: string | null; label: string }[] };
  reasons: Heading & { items: { tag: string; title: string; text: string; cta: string; target: 'whatsapp' | 'form' }[] };
  location: Heading;
  form: Heading;
  cta: Heading;
}
export const getContacto = (lang: Lang) => { const { l, img, heading } = projections(lang); return sanityFetch<Contacto>(`*[_id == "contacto"][0]{
  hero{ ${l('kicker')}, ${l('title')}, ${l('lead')}, ${img('image')}, "video": video.asset->url },
  channels{ ${heading()}, kpis[]{ value, ${l('label')} } },
  reasons{ ${heading()}, items[]{ ${l('tag')}, ${l('title')}, ${l('text')}, ${l('cta')}, target } },
  location{ ${heading()} }, form{ ${heading()} }, cta{ ${heading()} }
}`, { lang }); };

export interface NoticiasPage { hero: { kicker: string; title: string; lead: string; image: CmsImage; video: string | null }; index: Heading & { archive: string }; empty: { title: string; text: string }; cta: Heading }
export const getNoticiasPage = (lang: Lang) => { const { l, img, heading } = projections(lang); return sanityFetch<NoticiasPage>(`*[_id == "noticias"][0]{
  hero{ ${l('kicker')}, ${l('title')}, ${l('lead')}, ${img('image')}, "video": video.asset->url },
  index{ ${heading('archive')} }, empty{ ${l('title')}, ${l('text')} }, cta{ ${heading()} }
}`, { lang }); };

export interface NotaImage { url: string; width: number; height: number; alt: string | null; crop?: CmsImage['crop']; hotspot?: CmsImage['hotspot'] }
export interface NotaSeo { title: string | null; description: string | null; image: NotaImage | null }
export interface Nota { title: string; slug: string; date: string; updatedAt: string | null; category: string; tags: string[]; excerpt: string; readTime: string | null; image: NotaImage | null; video: string | null; body: unknown[] | null; translation: { slug: string } | null; seo: NotaSeo }
const notaImage = (path: string) => `"image": ${path}{ "url": asset->url, "width": asset->metadata.dimensions.width, "height": asset->metadata.dimensions.height, crop, hotspot, alt }`;
const notaFields = `title, "slug": slug.current, date, "updatedAt": _updatedAt, category, "tags": coalesce(tags, []), excerpt, readTime,
  ${notaImage('image')}, "video": video.asset->url,
  "seo": { "title": seo.title, "description": seo.description, ${notaImage('seo.image')} },
  body[]{ ..., _type == "image" => { "url": asset->url, "width": asset->metadata.dimensions.width, "height": asset->metadata.dimensions.height } },
  "translation": *[_type == "translation.metadata" && references(^._id)][0].translations[language != $lang][0].value->{ "slug": slug.current }`;
export const getNotas = (lang: Lang) => sanityFetch<Nota[]>(`*[_type == "nota" && language == $lang && defined(slug.current)] | order(date desc){ ${notaFields} }`, { lang });
export const getNota = (lang: Lang, slug: string) => sanityFetch<Nota | null>(`*[_type == "nota" && language == $lang && slug.current == $slug][0]{ ${notaFields} }`, { lang, slug });
