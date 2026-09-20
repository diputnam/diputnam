# Putnam Desarrollos Inmobiliarios

Sitio estático (Astro 7) en español e inglés cuyo contenido, imágenes y documentos se editan en Sanity.

## Estructura

| Carpeta | Qué contiene |
|---|---|
| `src/views/` | Una plantilla por página; reciben `lang` y leen el contenido del CMS con `src/lib/content.ts`. |
| `src/pages/` | Rutas: español sin prefijo, inglés bajo `/en/` con slugs traducidos (`src/i18n/routes.ts`). |
| `src/i18n/` | Textos de interfaz (`es.ts`, `en.ts`); ambos deben tener las mismas claves o el build falla. |
| `src/lib/` | `sanity.ts` (cliente), `content.ts` (consultas GROQ), `images.ts` (variantes del CDN de imágenes). |
| `studio/` | Sanity Studio: schemas, estructura y seed. Instalación aparte (`npm --prefix studio install`). |
| `scripts/` | Generadores de activos de marca: `trace-mark.mjs` (mark vectorial), `icons.mjs` (favicons, manifest), `og.mjs` (portadas para redes). |
| `tests/` | Comprobaciones Playwright y guards del build (`check-dist`, `seo-audit`). |

## Variables de entorno

Copia `.env.example` a `.env`:

```
SANITY_PROJECT_ID=<id del proyecto>
SANITY_DATASET=production
```

Sin ellas el build falla nombrando la variable ausente. Para trabajar sin proyecto (o en CI sin acceso) existe un dataset local:

```
node studio/scripts/seed-local.ts          # genera studio/.local/dataset.json
SANITY_LOCAL_DATASET=studio/.local/dataset.json npm run build
```

`SANITY_LOCAL_DATASET` tiene prioridad sobre el proyecto remoto: quítala de `.env` para construir contra Sanity.

## Comandos

```
npm run dev / build / preview
npm run test:i18n      # rutas, hreflang y selector de idioma (incluye las páginas de proyecto)
npm run test:eredita   # galería de medios de las tipologías en desktop (video, teclado, reduced motion)
npm run test:sweep     # home
npm run test:mobile    # auditoría móvil de todas las rutas (incluye una nota y un proyecto Ereditá)
npm run test:perf      # presupuesto de frames en móvil
npm run test:seo       # metadatos, JSON-LD, sitemap, robots, llms.txt, 404 (también corre en postbuild)
npm run assets:og      # regenera public/og/*.png (tras cambiar títulos en src/i18n o la marca)
npm run assets:icons   # regenera favicon.svg/.ico, apple-touch-icon, icons/ y site.webmanifest
npm run studio:dev     # Studio en local (studio/.env con SANITY_STUDIO_PROJECT_ID)
npm run studio:deploy  # publica el Studio en <nombre>.sanity.studio
npm run studio:seed    # carga el contenido inicial (una sola vez, requiere sanity login)
npm --prefix studio run migrate:proyectos   # una vez: mueve el contenido de Ereditá al proyecto EREDITÁ Art (acepta -- --dry-run)
```

Los tests corren contra `astro preview` (o `BASE_URL`).

## Sanity

### Primera puesta en marcha

1. `cd studio && npx sanity login && npx sanity init --bare` — crea el proyecto y el dataset `production`; anota el `projectId`.
2. `studio/.env`: `SANITY_STUDIO_PROJECT_ID=<id>`, `SANITY_STUDIO_DATASET=production`. Raíz `.env`: `SANITY_PROJECT_ID=<id>`, `SANITY_DATASET=production`.
3. Revisa el inglés propuesto en `studio/scripts/seed.en.ts` y ejecuta `npm run studio:seed`. Sube las imágenes mock como assets y crea todo el contenido con ids fijos; volver a ejecutarlo reemplaza esos documentos y respeta los creados después en el Studio.
4. `npm run studio:deploy` e invita al administrador desde [sanity.io/manage](https://www.sanity.io/manage).

### Modelo de contenido

- **Secciones del sitio** (un documento fijo cada una): Inicio, Ereditá (línea), La firma, Únete, Contacto, Noticias (portada) y Datos de contacto. Cada texto tiene español (obligatorio) e inglés (opcional; el sitio cae al español si falta). En los títulos, cada Intro es un salto de renglón.
- **Proyectos Ereditá**: Ereditá es una línea de edificios. `/eredita/` es su portada (hero, concepto y una tarjeta por proyecto) y cada proyecto —"EREDITÁ Art", y los que se creen después— es un documento con nombre, ruta (`/eredita/<ruta>/` y `/en/eredita/<ruta>/`), orden, estado, tarjeta y el contenido comercial (introducción, galería, tipologías, documentación, cierre). Publicar un proyecto nuevo no requiere código: entra solo en la portada, el sitemap y `llms.txt`.
- **Tipologías**: cada una tiene un video opcional (mp4, con póster) y una lista de renders/fotos con pie. En el panel se ve el video por defecto (silenciado, en bucle, solo mientras el panel está visible; sin autoplay con movimiento reducido) o la primera imagen, y una tira de miniaturas permite elegir cada medio. Los videos van comprimidos: H.264, ≤ 1280 px, ≤ 5 MB (el CDN de Sanity en plan free tiene ~10 GB/mes).
- **Notas**: un documento por idioma, enlazados con el botón de traducciones del Studio. Una nota solo en español no aparece en `/en/news/`.
- **Documentos legales** (Ereditá): título, descripción, orden, proyecto opcional (vacío = se muestra en todos los proyectos) y PDF opcional. Sin archivo la tarjeta muestra "Próximamente"; con archivo son obligatorias la versión y la fecha de vigencia, y reemplazar el PDF sin cambiar la versión bloquea la publicación. Las versiones anteriores quedan en el historial del documento.
- **Imágenes**: todas con punto focal (hotspot) y recorte editables; el sitio genera las variantes por ancho y el tratamiento tonal desde el CDN de Sanity.

### Publicación automática

Solo se publica contenido con **Publish**. Cada publicación dispara un webhook que reconstruye el sitio:

- **Vercel**: importa el repo (framework Astro, salida `dist/`) con las variables `SANITY_PROJECT_ID` y `SANITY_DATASET`; cada push a `main` despliega.
- Webhook `vercel-deploy` (ya creado; se ve en [sanity.io/manage](https://www.sanity.io/manage) → API → Webhooks): URL del *Deploy Hook* de Vercel (Settings → Git → Deploy Hooks), método `POST`, filtro GROQ `!(_type match "sanity.*")` (todo menos assets, así subir un archivo no dispara builds), solo publicados, en create/update/delete.
- Cabeceras de caché y seguridad en `vercel.json`; `www` → apex se configura en Vercel → Domains.

## Dominio, SEO y motores generativos

El dominio canónico es `https://www.diputnam.com` (`site` en `astro.config.mjs`). Toda URL absoluta del sitio —`canonical`, `hreflang`, Open Graph, sitemap, `llms.txt`— sale de ahí, también en vistas previas en `*.vercel.app`, para que solo el dominio final se indexe.

Qué publica cada build en la raíz de `dist/`:

- `robots.txt`: permite todo el sitio a buscadores y a rastreadores de IA (GPTBot, ClaudeBot, PerplexityBot…) y declara el sitemap.
- `sitemap.xml`: las doce rutas y todas las notas con `lastmod` (última publicación en Sanity) y alternativas `hreflang`.
- `llms.txt`: resumen de Putnam, páginas y notas en ambos idiomas, contacto.
- `404.html`: página no encontrada bilingüe (`noindex`); Vercel la sirve con estado 404.
- `vercel.json`: caché inmutable para `/_astro/`, `/fonts/`; cabeceras de seguridad.

Cada página lleva `canonical`, Open Graph/Twitter con su portada (`public/og/<página>-<idioma>.png`; las notas usan su imagen destacada recortada por el CDN de Sanity) y datos estructurados JSON-LD (`Organization`, `WebSite`, tipo de página, `BreadcrumbList`, `NewsArticle` en notas). `<title>` y `meta description` de las páginas estáticas están en `src/i18n/{es,en}.ts` → `meta` (30–60 y 110–155 caracteres; `seo-audit` lo verifica). En el Studio:

- **Datos de contacto → Datos de la empresa (SEO)**: descripción, razón social, año de fundación, redes (`sameAs`), logo cuadrado opcional.
- **Nota → SEO y redes**: título, descripción e imagen para compartir; si se dejan vacíos se derivan del título, el extracto y la imagen destacada.

### Cuando el dominio apunte a Vercel

1. Vercel → Settings → Domains: añadir `www.diputnam.com` **y** `diputnam.com`, con el apex marcado como *Redirect to* `www.diputnam.com` (308). HTTPS lo gestiona Vercel; la barra final la fija `trailingSlash: always` de Astro.
2. Verificar `curl -I https://diputnam.com/eredita` → `308` a `https://www.diputnam.com/eredita/` y `https://www.diputnam.com/proyectos/` → `404`.
3. [Google Search Console](https://search.google.com/search-console) y [Bing Webmaster Tools](https://www.bing.com/webmasters): verificar la propiedad (registro DNS TXT en el proveedor del dominio) y enviar `https://www.diputnam.com/sitemap.xml`.
4. Crear o reclamar el [Perfil de Negocio de Google](https://business.google.com) de la oficina de San Miguel y añadir su URL, junto a las redes, en **Datos de la empresa (SEO) → Redes y perfiles**.
5. Comprobar una URL de cada tipo en la [prueba de resultados enriquecidos](https://search.google.com/test/rich-results), el [Sharing Debugger](https://developers.facebook.com/tools/debug/) de Meta y el [Post Inspector](https://www.linkedin.com/post-inspector/) de LinkedIn.
