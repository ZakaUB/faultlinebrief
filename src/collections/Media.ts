import type { CollectionConfig } from 'payload'

const isAdmin = (user: unknown): boolean =>
  (user as { role?: string } | null)?.role === 'admin'
const isDraftPublisher = (user: unknown): boolean =>
  (user as { role?: string } | null)?.role === 'draft_publisher'

export const Media: CollectionConfig = {
  slug: 'media',
  access: {
    read: () => true,
    create: ({ req }) => isAdmin(req.user) || isDraftPublisher(req.user),
    update: ({ req }) => isAdmin(req.user),
    delete: ({ req }) => isAdmin(req.user),
  },
  fields: [{ name: 'alt', type: 'text', required: true }],
  upload: { crop: false, focalPoint: false },
}
