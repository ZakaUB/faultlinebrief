import type { CollectionConfig } from 'payload'
import { lexicalEditor } from '@payloadcms/richtext-lexical'

const isAdmin = (user: unknown): boolean =>
  (user as { role?: string } | null)?.role === 'admin'
const isDraftPublisher = (user: unknown): boolean =>
  (user as { role?: string } | null)?.role === 'draft_publisher'

export const Articles: CollectionConfig = {
  slug: 'articles',
  admin: {
    useAsTitle: 'headline',
    defaultColumns: ['headline', 'status', 'publishedAt', 'updatedAt'],
  },
  access: {
    read: () => true,
    create: ({ req }) => isAdmin(req.user) || isDraftPublisher(req.user),
    update: ({ req }) =>
      isAdmin(req.user)
        ? true
        : isDraftPublisher(req.user)
          ? { status: { equals: 'draft' } }
          : false,
    delete: ({ req }) => isAdmin(req.user),
  },
  hooks: {
    beforeChange: [
      ({ data, req }) => {
        if (isDraftPublisher(req.user)) {
          if (data.status && data.status !== 'draft') {
            throw new Error('Draft publishers cannot publish articles.')
          }
          if (data.publishedAt) {
            throw new Error('Draft publishers cannot set publication dates.')
          }
          return { ...data, status: 'draft', publishedAt: null }
        }
        return data
      },
    ],
  },
  fields: [
    { name: 'headline', type: 'text', required: true },
    { name: 'slug', type: 'text', required: true, unique: true, index: true },
    { name: 'deck', label: 'Summary / Deck', type: 'textarea', required: true },
    { name: 'body', type: 'richText', required: true, editor: lexicalEditor({}) },
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
