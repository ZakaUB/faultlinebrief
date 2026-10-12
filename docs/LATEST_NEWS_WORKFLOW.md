# Faultline Brief — Editorial Placement in Payload

## Homepage
Home shows **one Lead Story plus six Featured Story portrait cards**. Other published articles remain in /analysis and their topical categories.

## Editorial Placement: three options
In Payload Admin, open **Collections → Articles → Create/Edit → Editorial Placement** (sidebar).

- **Lead Story** — the large homepage story, chosen by the editor. If more than one published lead is selected, the newest designated lead wins; earlier leads can appear among the six cards.
- **Featured Story** — eligible for the six-card grid. All 11 existing articles default to Featured Story upon schema migration.
- **News Story** — appears on /latest-news and in the five most recent Latest Updates links on Home. It does not displace Lead/Featured stories.

If no article has Lead Story selected, the newest Featured Story automatically occupies the lead slot. This maintains homepage content until an editor selects a lead.

**Editorial Placement and Categories are independent.** Select Geopolitics, Conflict or Security to populate thematic category lists. A separate Latest News category is no longer required.

Status must be Published for stories to appear; set Published At date/time. The existing Articles form still requires Headline, Slug, Deck, Body and Featured Image. Publishing and editing remain manual.

## Database schema step, pending owner approval
`ALTER TABLE public.articles ADD COLUMN IF NOT EXISTS editorial_placement varchar(32) NOT NULL DEFAULT 'featured';`

This additive migration was successfully tested on a temporary Neon branch, without changing article content, status, dates, slugs, images or categories. **Do not promote the code to Production until the production database column is added.**
