import type { CollectionConfig } from 'payload'
import { lexicalEditor } from '@payloadcms/richtext-lexical'

export const Articles: CollectionConfig = {
  slug: 'articles',
  admin: {
    useAsTitle: 'headline',
    defaultColumns: ['headline', 'homepageLead', 'status', 'publishedAt', 'updatedAt'],
  },
  hooks: {
    afterChange: [
      async ({ doc, req, context }) => {
        if (context?.updatingHomepageLead || !doc.homepageLead || doc.status !== 'published') return doc
        const previous = await req.payload.find({
          collection: 'articles',
          where: {
            and: [
              { homepageLead: { equals: true } },
              { id: { not_equals: doc.id } },
            ],
          },
          depth: 0,
          limit: 100,
          req,
        })
        for (const article of previous.docs) {
          await req.payload.update({
            collection: 'articles',
            id: article.id,
            data: { homepageLead: false },
            context: { updatingHomepageLead: true },
            req,
          })
        }
        return doc
      },
    ],
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
      name: 'homepageLead',
      label: 'Set as Homepage Lead',
      type: 'checkbox',
      defaultValue: false,
      admin: {
        position: 'sidebar',
        description: 'Only one published article can be the lead. Selecting this replaces the previous lead.',
      },
      validate: (value: unknown, { siblingData }: { siblingData: any }) =>
        !value || siblingData?.status === 'published' || 'Publish the article before selecting it as the homepage lead.',
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
