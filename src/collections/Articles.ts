import type { CollectionConfig } from 'payload'
import { lexicalEditor } from '@payloadcms/richtext-lexical'

export const Articles: CollectionConfig = {
  slug: 'articles',
  admin: {
    useAsTitle: 'headline',
    defaultColumns: ['headline', 'editorialPlacement', 'status', 'publishedAt', 'updatedAt'],
  },
  fields: [
    { name: 'headline', type: 'text', required: true },
    { name: 'slug', type: 'text', required: true, unique: true, index: true },
    { name: 'deck', label: 'Summary / Deck', type: 'textarea', required: true },
    {
      name: 'body',
      type: 'richText',
      required: true,
      editor: lexicalEditor({}),
    },
    { name: 'featuredImage', type: 'upload', relationTo: 'media', required: true },
    { name: 'categories', type: 'relationship', relationTo: 'categories' as any, hasMany: true },
    {
      name: 'status',
      type: 'select',
      required: true,
      defaultValue: 'draft',
      options: [
        { label: 'Draft', value: 'draft' },
        { label: 'Published', value: 'published' },
      ],
    },
    {
      name: 'editorialPlacement',
      label: 'Editorial Placement',
      type: 'select',
      required: true,
      defaultValue: 'featured',
      admin: {
        position: 'sidebar',
        description: 'Lead Story appears prominently; six Featured Stories fill the photo grid; News Stories appear in Latest News and Latest Updates.',
      },
      options: [
        { label: 'Lead Story', value: 'lead' },
        { label: 'Featured Story', value: 'featured' },
        { label: 'News Story', value: 'news' },
      ],
    },
    { name: 'publishedAt', type: 'date', admin: { date: { pickerAppearance: 'dayAndTime' } } },
    {
      name: 'sources',
      type: 'array',
      fields: [
        { name: 'name', type: 'text', required: true },
        { name: 'url', type: 'text' },
      ],
    },
    {
      name: 'seo',
      type: 'group',
      fields: [
        { name: 'title', type: 'text' },
        { name: 'description', type: 'textarea' },
      ],
    },
  ],
}
