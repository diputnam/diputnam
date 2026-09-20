import { defineArrayMember, defineField, defineType } from 'sanity';

// One document per language, linked by @sanity/document-internationalization.
export const nota = defineType({
  name: 'nota',
  title: 'Nota',
  type: 'document',
  fields: [
    defineField({ name: 'language', type: 'string', readOnly: true, hidden: true }),
    defineField({ name: 'title', title: 'Título', type: 'string', validation: (rule) => rule.required() }),
    defineField({ name: 'slug', title: 'Slug', type: 'slug', options: { source: 'title', maxLength: 96 }, validation: (rule) => rule.required().custom(async (value, context) => {
      // Unique per language: the same slug may exist in the other language.
      if (!value?.current) return true;
      const { document, getClient } = context;
      const client = getClient({ apiVersion: '2026-09-01' });
      const id = (document?._id ?? '').replace(/^drafts\./, '');
      const clash = await client.fetch<number>(`count(*[_type == "nota" && slug.current == $slug && language == $language && !(_id in [$id, "drafts." + $id])])`, { slug: value.current, language: document?.language, id });
      return clash === 0 || 'Ya existe una nota con este slug en este idioma.';
    }) }),
    defineField({ name: 'date', title: 'Fecha', type: 'date', validation: (rule) => rule.required() }),
    defineField({ name: 'category', title: 'Categoría', type: 'string', validation: (rule) => rule.required() }),
    defineField({ name: 'tags', title: 'Etiquetas', type: 'array', of: [defineArrayMember({ type: 'string' })], options: { layout: 'tags' } }),
    defineField({ name: 'excerpt', title: 'Extracto', type: 'text', rows: 4, validation: (rule) => rule.required().max(400) }),
    defineField({ name: 'readTime', title: 'Tiempo de lectura', type: 'string', description: 'P. ej. "4 min".' }),
    defineField({ name: 'image', title: 'Imagen destacada', type: 'image', options: { hotspot: true }, fields: [defineField({ name: 'alt', title: 'Texto alternativo', type: 'string' })] }),
    defineField({ name: 'video', title: 'Video de hero (opcional, mp4)', type: 'file', options: { accept: 'video/mp4' }, description: 'La imagen destacada funciona como póster. Se reproduce automáticamente, sin sonido y en bucle.', validation: (rule) => rule.custom((value, context) => (!value || context.document?.image ? true : 'Añade una imagen destacada para usarla como póster.')) }),
    defineField({ name: 'body', title: 'Cuerpo', type: 'richText' }),
    // Optional overrides for search and social previews; the site derives them from
    // title/excerpt/image when empty.
    defineField({
      name: 'seo', title: 'SEO y redes', type: 'object', options: { collapsible: true, collapsed: true },
      fields: [
        defineField({ name: 'title', title: 'Título para buscadores', type: 'string', description: 'Máximo 60 caracteres. Si se deja vacío se recorta el título de la nota.', validation: (rule) => rule.max(60) }),
        defineField({ name: 'description', title: 'Descripción para buscadores', type: 'text', rows: 3, description: 'Máximo 155 caracteres. Si se deja vacío se recorta el extracto.', validation: (rule) => rule.max(155) }),
        defineField({ name: 'image', title: 'Imagen para compartir', type: 'image', options: { hotspot: true }, description: 'Se recorta a 1200×630. Si falta se usa la imagen destacada.', fields: [defineField({ name: 'alt', title: 'Texto alternativo', type: 'string' })] }),
      ],
    }),
  ],
  orderings: [{ title: 'Fecha, más reciente', name: 'dateDesc', by: [{ field: 'date', direction: 'desc' }] }],
  preview: {
    select: { title: 'title', subtitle: 'date', media: 'image', language: 'language' },
    prepare: ({ title, subtitle, media, language }) => ({ title, subtitle: `${language?.toUpperCase() ?? ''} · ${subtitle ?? ''}`, media }),
  },
});
