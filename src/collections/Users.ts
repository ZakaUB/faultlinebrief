import type { CollectionConfig } from 'payload'

const isAdmin = (user: unknown): boolean =>
  (user as { role?: string } | null)?.role === 'admin'

export const Users: CollectionConfig = {
  slug: 'users',
  admin: { useAsTitle: 'email' },
  auth: { useAPIKey: true },
  access: {
    create: ({ req }) => isAdmin(req.user),
    read: ({ req }) =>
      isAdmin(req.user) ? true : req.user ? { id: { equals: req.user.id } } : false,
    update: ({ req }) => isAdmin(req.user),
    delete: ({ req }) => isAdmin(req.user),
  },
  fields: [
    {
      name: 'role',
      type: 'select',
      required: true,
      defaultValue: 'draft_publisher',
      saveToJWT: true,
      options: [
        { label: 'Administrator', value: 'admin' },
        { label: 'Draft Publisher', value: 'draft_publisher' },
      ],
      access: {
        create: ({ req }) => isAdmin(req.user),
        update: ({ req }) => isAdmin(req.user),
      },
    },
  ],
}
