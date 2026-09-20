import { defineArrayMember, defineField, defineType } from 'sanity';

export const kicker = defineField({ name: 'kicker', title: 'Kicker', type: 'localeString' });
export const title = defineField({ name: 'title', title: 'Título', type: 'localeTitle', validation: (rule) => rule.required() });
export const text = defineField({ name: 'text', title: 'Texto', type: 'localeText' });
export const heroVideo = defineField({ name: 'video', title: 'Video (opcional, mp4)', type: 'file', options: { accept: 'video/mp4' }, description: 'Se reproduce automáticamente, sin sonido y en bucle. Sube H.264, máximo 1280 px de ancho y 5 MB.' });
const items = (name: string, label: string) => defineField({ name, title: label, type: 'array', of: [defineArrayMember({ type: 'titledItem' })] });
const numberedItems = (name: string, label: string) =>
  defineField({
    name, title: label, type: 'array',
    of: [defineArrayMember({ type: 'object', fields: [
      defineField({ name: 'number', title: 'Número', type: 'string', validation: (rule) => rule.required() }),
      defineField({ name: 'title', title: 'Título', type: 'localeString', validation: (rule) => rule.required() }),
      defineField({ name: 'text', title: 'Texto', type: 'localeText', validation: (rule) => rule.required() }),
      defineField({ name: 'image', title: 'Imagen', type: 'localeImage' }),
    ], preview: { select: { title: 'title.es', subtitle: 'number' } } })],
  });
export const section = (name: string, label: string, fields: ReturnType<typeof defineField>[]) =>
  defineField({ name, title: label, type: 'object', options: { collapsible: true, collapsed: false }, fields });

// Hero and introduction are shared by the Ereditá line and by every project.
export const erediteHeroFields = [
  kicker, title,
  defineField({ name: 'sub', title: 'Subtítulo', type: 'localeString' }),
  defineField({ name: 'poster', title: 'Imagen', type: 'localeImage', validation: (rule) => rule.required() }),
  heroVideo,
];
export const erediteIntroFields = [
  kicker, title,
  defineField({ name: 'lead', title: 'Entrada', type: 'localeText' }),
  defineField({ name: 'bullets', title: 'Puntos', type: 'array', of: [defineArrayMember({ type: 'localeString' })] }),
  defineField({ name: 'facts', title: 'Datos', type: 'array', of: [defineArrayMember({ type: 'labelValue' })] }),
];

export const home = defineType({
  name: 'home',
  title: 'Inicio',
  type: 'document',
  fields: [
    defineField({
      name: 'scenes', title: 'Escenas', type: 'array',
      validation: (rule) => rule.required().length(4),
      of: [defineArrayMember({
        type: 'object',
        fields: [
          defineField({ name: 'id', title: 'Identificador', type: 'string', options: { list: ['inicio', 'eredita', 'putnam', 'contacto'] }, validation: (rule) => rule.required() }),
          defineField({ name: 'title', title: 'Título', type: 'localeTitle', validation: (rule) => rule.required().custom((value) => ((value as { es?: string })?.es?.length ?? 0) <= 32 || 'Máximo 32 caracteres en español para que quepa en dos renglones.') }),
          defineField({ name: 'image', title: 'Imagen', type: 'localeImage', validation: (rule) => rule.required() }),
          heroVideo,
        ],
        preview: { select: { title: 'title.es', subtitle: 'id', media: 'image' } },
      })],
    }),
  ],
  preview: { prepare: () => ({ title: 'Inicio' }) },
});

// Ereditá is a line of buildings: the singleton is the line's landing page, the
// commercial content (gallery, typologies, documents) lives in each `proyecto`.
export const eredita = defineType({
  name: 'eredita',
  title: 'Ereditá (línea)',
  type: 'document',
  fields: [
    section('hero', 'Hero', erediteHeroFields),
    section('intro', 'Introducción', erediteIntroFields),
    section('projects', 'Proyectos', [kicker, title, text]),
    section('cta', 'Cierre', [kicker, title]),
  ],
  preview: { prepare: () => ({ title: 'Ereditá (línea)' }) },
});

export const putnam = defineType({
  name: 'putnam',
  title: 'La firma',
  type: 'document',
  fields: [
    section('hero', 'Hero', [kicker, title, defineField({ name: 'lead', title: 'Entrada', type: 'localeText' }), defineField({ name: 'image', title: 'Imagen', type: 'localeImage', validation: (rule) => rule.required() }), heroVideo]),
    section('process', 'Proceso', [kicker, numberedItems('steps', 'Etapas')]),
    section('principles', 'Principios', [
      kicker, title,
      defineField({ name: 'mission', title: 'Misión', type: 'object', fields: [defineField({ name: 'label', title: 'Etiqueta', type: 'localeString' }), defineField({ name: 'title', title: 'Título', type: 'localeString' }), defineField({ name: 'text', title: 'Texto', type: 'localeText' })] }),
      defineField({ name: 'vision', title: 'Visión', type: 'object', fields: [defineField({ name: 'label', title: 'Etiqueta', type: 'localeString' }), defineField({ name: 'title', title: 'Título', type: 'localeString' }), defineField({ name: 'text', title: 'Texto', type: 'localeText' })] }),
      defineField({ name: 'valuesLabel', title: 'Etiqueta de valores', type: 'localeString' }),
      defineField({ name: 'valuesTitle', title: 'Título de valores', type: 'localeString' }),
      defineField({ name: 'values', title: 'Valores', type: 'array', of: [defineArrayMember({ type: 'localeString' })] }),
    ]),
    section('differences', 'Diferenciadores', [kicker, title, numberedItems('items', 'Diferenciadores')]),
    section('cta', 'Cierre', [kicker, title]),
  ],
  preview: { prepare: () => ({ title: 'La firma' }) },
});

export const unete = defineType({
  name: 'unete',
  title: 'Únete',
  type: 'document',
  fields: [
    section('hero', 'Hero', [
      kicker, title, defineField({ name: 'lead', title: 'Entrada', type: 'localeText' }),
      defineField({ name: 'meta', title: 'Líneas de meta', type: 'array', of: [defineArrayMember({ type: 'localeString' })] }),
      defineField({ name: 'image', title: 'Imagen', type: 'localeImage', validation: (rule) => rule.required() }),
      heroVideo,
    ]),
    section('culture', 'Cultura', [kicker, title, text, items('traits', 'Rasgos')]),
    section('profile', 'Perfil', [kicker, title, text, items('values', 'Valores'), defineField({ name: 'kpis', title: 'Cifras', type: 'array', of: [defineArrayMember({ type: 'labelValue' })] })]),
    section('openings', 'Oportunidades', [
      kicker, title, text,
      defineField({ name: 'emptyKicker', title: 'Kicker del panel vacío', type: 'localeString' }),
      defineField({ name: 'emptyTitle', title: 'Título del panel vacío', type: 'localeString' }),
      defineField({ name: 'emptyText', title: 'Párrafos del panel vacío', type: 'array', of: [defineArrayMember({ type: 'localeText' })] }),
      defineField({ name: 'cta', title: 'Botón', type: 'localeString' }),
    ]),
    section('process', 'Proceso de selección', [kicker, title, text, items('steps', 'Pasos')]),
    section('spontaneous', 'Postulación espontánea', [kicker, title, text, defineField({ name: 'fields', title: 'Áreas', type: 'array', of: [defineArrayMember({ type: 'localeString' })] })]),
    section('apply', 'Cierre', [kicker, title, text]),
    section('mail', 'Correo de postulación', [
      defineField({ name: 'body', title: 'Cuerpo del correo', type: 'localeText', description: 'Plantilla que se abre al enviar el perfil por correo.' }),
      defineField({ name: 'whatsapp', title: 'Mensaje de WhatsApp', type: 'localeString' }),
    ]),
  ],
  preview: { prepare: () => ({ title: 'Únete' }) },
});

export const contacto = defineType({
  name: 'contacto',
  title: 'Contacto',
  type: 'document',
  fields: [
    section('hero', 'Hero', [kicker, title, defineField({ name: 'lead', title: 'Entrada', type: 'localeText' }), defineField({ name: 'image', title: 'Imagen', type: 'localeImage', validation: (rule) => rule.required() }), heroVideo]),
    section('channels', 'Canales', [
      kicker, title, text,
      defineField({
        name: 'kpis', title: 'Cifras', type: 'array',
        description: 'Deja el valor vacío para mostrar el tiempo de respuesta de Datos de contacto.',
        of: [defineArrayMember({ type: 'object', fields: [defineField({ name: 'value', title: 'Valor', type: 'string' }), defineField({ name: 'label', title: 'Etiqueta', type: 'localeString', validation: (rule) => rule.required() })], preview: { select: { title: 'label.es', subtitle: 'value' } } })],
      }),
    ]),
    section('reasons', 'Motivos', [
      kicker, title,
      defineField({
        name: 'items', title: 'Motivos', type: 'array',
        of: [defineArrayMember({ type: 'object', fields: [
          defineField({ name: 'tag', title: 'Etiqueta', type: 'localeString' }),
          defineField({ name: 'title', title: 'Título', type: 'localeString', validation: (rule) => rule.required() }),
          defineField({ name: 'text', title: 'Texto', type: 'localeText' }),
          defineField({ name: 'cta', title: 'Texto del enlace', type: 'localeString' }),
          defineField({ name: 'target', title: 'Destino', type: 'string', options: { list: [{ title: 'WhatsApp', value: 'whatsapp' }, { title: 'Formulario', value: 'form' }] }, initialValue: 'form' }),
        ], preview: { select: { title: 'title.es', subtitle: 'tag.es' } } })],
      }),
    ]),
    section('location', 'Ubicación', [kicker, title, text]),
    section('form', 'Formulario', [kicker, title, defineField({ name: 'text', title: 'Texto', type: 'localeText', description: 'Puedes escribir {responseTime} para insertar el tiempo de respuesta.' })]),
    section('cta', 'Cierre', [kicker, title, text]),
  ],
  preview: { prepare: () => ({ title: 'Contacto' }) },
});

export const noticias = defineType({
  name: 'noticias',
  title: 'Noticias (portada)',
  type: 'document',
  fields: [
    section('hero', 'Hero', [kicker, title, defineField({ name: 'lead', title: 'Entrada', type: 'localeText' }), defineField({ name: 'image', title: 'Imagen', type: 'localeImage', validation: (rule) => rule.required() }), heroVideo]),
    section('index', 'Índice', [kicker, title, defineField({ name: 'archive', title: 'Etiqueta de archivo', type: 'string', description: 'P. ej. el año.' })]),
    section('empty', 'Sin notas', [title, text]),
    section('cta', 'Cierre', [kicker, title, text]),
  ],
  preview: { prepare: () => ({ title: 'Noticias (portada)' }) },
});
