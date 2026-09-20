import { defineArrayMember, defineField, defineType } from 'sanity';
import { erediteHeroFields, erediteIntroFields, kicker, section, title } from './pages';

type TypologyVideo = { video?: { asset?: { _ref?: string } } };

// One video medium: its own file + poster, so a typology can carry several (renders and
// videos share one ordered list below, same pattern as the project gallery).
const typologyVideo = defineArrayMember({
  type: 'object',
  name: 'typologyVideo',
  title: 'Video',
  fields: [
    defineField({
      name: 'video', title: 'Video (mp4)', type: 'file', options: { accept: 'video/mp4' },
      description: 'Se muestra silenciado y en bucle. Súbelo comprimido: H.264, máximo 1280 px de ancho y 5 MB.',
      validation: (rule) => rule.required().custom((value) => {
        const ref = (value as TypologyVideo['video'])?.asset?._ref;
        return !ref || ref.endsWith('-mp4') ? true : 'Solo se aceptan videos mp4.';
      }),
    }),
    defineField({ name: 'poster', title: 'Póster del video', type: 'localeImage', description: 'Imagen que se ve antes de reproducirlo.', validation: (rule) => rule.required() }),
    defineField({ name: 'caption', title: 'Pie', type: 'localeString' }),
  ],
  preview: { select: { title: 'caption.es', media: 'poster' } },
});

// A typology shows one medium at a time, picked from a thumbnail strip on the site; renders
// and videos share one ordered list, so an editor can mix and add as many videos as needed.
const typology = defineArrayMember({
  type: 'object',
  fields: [
    defineField({ name: 'id', title: 'Identificador', type: 'slug', validation: (rule) => rule.required() }),
    defineField({ name: 'tag', title: 'Etiqueta', type: 'localeString' }),
    defineField({ name: 'tone', title: 'Tono', type: 'string', options: { list: ['azul', 'verde'] }, initialValue: 'azul' }),
    defineField({ name: 'title', title: 'Título', type: 'localeString', validation: (rule) => rule.required() }),
    defineField({ name: 'subtitle', title: 'Subtítulo', type: 'localeString' }),
    defineField({
      name: 'images', title: 'Renders, fotos y videos', type: 'array', options: { layout: 'grid' },
      of: [defineArrayMember({ type: 'captionedImage' }), typologyVideo],
      validation: (rule) => rule.min(1).error('Añade al menos un render, foto o video.'),
    }),
    defineField({ name: 'description', title: 'Descripción', type: 'localeText' }),
    defineField({ name: 'specs', title: 'Ficha', type: 'array', of: [defineArrayMember({ type: 'labelValue' })] }),
  ],
  preview: { select: { title: 'title.es', subtitle: 'subtitle.es', media: 'images.0' } },
});

export const proyecto = defineType({
  name: 'proyecto',
  title: 'Proyecto Ereditá',
  type: 'document',
  fields: [
    defineField({ name: 'name', title: 'Nombre', type: 'string', description: 'P. ej. "Ereditá Art".', validation: (rule) => rule.required() }),
    defineField({
      name: 'slug', title: 'Ruta', type: 'slug', description: 'Se publica en /eredita/<ruta>/ en ambos idiomas.',
      options: { source: 'name', maxLength: 60 },
      validation: (rule) => rule.required().custom((value) => {
        const current = (value as { current?: string } | undefined)?.current ?? '';
        return /^[a-z0-9]+(-[a-z0-9]+)*$/.test(current) ? true : 'Solo minúsculas, números y guiones (p. ej. "eredita-art").';
      }),
    }),
    defineField({ name: 'order', title: 'Orden', type: 'number', validation: (rule) => rule.required().integer().min(1) }),
    defineField({ name: 'status', title: 'Estado', type: 'localeString', description: 'P. ej. "En preventa", "En construcción".' }),
    section('card', 'Tarjeta en la portada de Ereditá', [
      defineField({ name: 'image', title: 'Imagen', type: 'localeImage', validation: (rule) => rule.required() }),
      defineField({ name: 'text', title: 'Texto breve', type: 'localeText', validation: (rule) => rule.required() }),
    ]),
    section('hero', 'Hero', erediteHeroFields),
    section('intro', 'Introducción', erediteIntroFields),
    section('gallery', 'Galería', [
      kicker, title,
      defineField({
        name: 'items', title: 'Fotos, renders y videos', type: 'array',
        of: [defineArrayMember({ type: 'object', fields: [
          defineField({ name: 'image', title: 'Imagen / póster', type: 'localeImage', validation: (rule) => rule.required() }),
          defineField({ name: 'video', title: 'Video (opcional, mp4)', type: 'file', options: { accept: 'video/mp4' }, description: 'Si subes un video, reemplaza visualmente la imagen; la imagen queda como póster mientras carga.' }),
          defineField({ name: 'tag', title: 'Etiqueta', type: 'localeString', description: 'Fotografía, Render…' }),
        ], preview: { select: { title: 'tag.es', media: 'image' } } })],
      }),
    ]),
    section('typologies', 'Tipologías', [
      kicker, title,
      defineField({ name: 'intro', title: 'Introducción', type: 'localeText' }),
      defineField({ name: 'items', title: 'Tipologías', type: 'array', of: [typology] }),
    ]),
    section('legal', 'Documentación para compradores', [kicker, title, defineField({ name: 'lead', title: 'Entrada', type: 'localeText' })]),
    section('cta', 'Cierre', [kicker, title]),
  ],
  orderings: [{ title: 'Orden', name: 'order', by: [{ field: 'order', direction: 'asc' }] }],
  preview: { select: { title: 'name', subtitle: 'slug.current', media: 'card.image' } },
});
