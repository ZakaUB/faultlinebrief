# Faultline Brief — Pre-AdSense Readiness Audit

Date: 2026-10-14
Scope: production Payload articles and active GitHub branch `google-news-sitemap`.
Status: **Preparation in progress. Not an AdSense approval guarantee.**

## Confirmed state

- 19 published articles in the production Neon/Payload database, published 2026-10-07 through 2026-10-13 UTC.
- 19/19 articles have featured-media relationships, SEO titles and SEO descriptions.
- All articles have non-empty body content; five short-news updates are about 270–310 words and the longer reports range from roughly 1,600 to 5,200 words.
- Pages for About, Contact, Privacy, Editorial Standards and the Editorial Desk are implemented.
- The homepage and article pages previously rendered empty `ADVERTISEMENT` placeholders; these were removed in GitHub on 2026-10-14. Empty placeholders on the unindexed archive preview were removed too. The article-reading column was re-centered.
- Code audit is **not** verification of a successful production Vercel deployment or of live responsiveness, copyright licenses or the truth of every article claim.

## High-priority editorial corrections (Payload CMS)

| Article slug | Words (approx.) | Source entries | Follow-up |
| --- | ---: | ---: | --- |
| `ukraine-zelensky-allied-warning-russian-missiles-kyiv-october-2026` | 288 | 0 | Add the Associated Press report as a source. |
| `colombia-farc-leaders-war-crimes-indigenous-groups-october-2026` | 306 | 0 | Add the Associated Press report as a source. |
| `congo-kabila-m23-new-rebel-coalition-october-2026` | 280 | 0 | Add Reuters and independently verify characterization of the coalition. |
| `who-are-the-houthis-history-sanaa-2014-saudi-arabia-conflict` | 5212 | 2 | Review factual claims against stronger primary/independent sourcing and image rights. |
| `bulgaria-black-sea-drone-strikes-russia-nato-escalation-risk` | 2434 | 2 | Keep attribution and the territorial-waters distinction carefully qualified. |
| `space-next-faultline-global-power-future-conflict` | 2196 | 3 | Review source labels and image licensing; ensure it is not an unintended Lead Story. |
| `navi-pillay-nobel-peace-prize-2026-international-law` | 3592 | 3 | Shorten keyword-stuffed SEO description; verify photo rights. |
| `will-humanity-end-by-2100-lancet-nuclear-war-ai-analysis` | 3678 | 3 | Correct mismatched source names (one labeled The Lancet links to EurekAlert; another name is a URL) and check image rights. |

Suggested direct source URLs for the three articles with missing source entries:

- Ukraine: https://apnews.com/article/10c54e55f31aded2db95242fdb4fd153
- Colombia: https://apnews.com/article/e4d83f482eea7b6886e138e4d85a9046
- Congo: https://www.reuters.com/world/congos-former-president-kabila-forms-new-group-replace-m23-insurgency-2026-10-12/

## Editorial placement

Three articles currently carry `editorial_placement=lead`: Houthis history, Bulgaria drone strikes, and Space as the next faultline. The homepage chooses one for display, but Payload should retain **exactly one** current designated Lead Story and return the others to Featured Story. Confirm intended editorial choice before changing these records.

## Rights and accessibility

The media collection includes filenames, alt text and sizes but does not record licenses, creators or publication permissions. Audit **all 19 image rights** manually; add creator/credit/license information in an editorial records system. Avoid republishing wire-agency photographs without authorization. Replace filename-like image alt text with human-readable descriptions.

## Other pre-application checks

- Verify Vercel Production has deployed the latest branch after removal of placeholders; inspect desktop and mobile layouts.
- Review the 19 articles for meaningful original reporting or analysis, factual support, chronology, claims, and near-duplicate treatment. This metadata audit alone cannot certify originality.
- Check category, archive, editorial team, mobile navigation and sitemap pages are usable, without broken links or misleading preview content.
- When applying to AdSense, add ownership verification and `ads.txt` exactly as instructed by Google. Do not publish an invented publisher ID.
- Before serving Google ads, configure an appropriate consent-management solution where legally required.
- **Important commercial-hosting constraint:** Vercel Hobby is for personal, non-commercial use. Its Fair Use Guidelines explicitly classify Google AdSense advertisements as commercial usage; migrate to an allowed paid plan or alternative commercial host before serving ads.
- Leave existing Vercel–Neon–R2 hosting and analytics intact. The old Cloudflare Workers build is still configured and can fail independently; its failing GitHub check is not proof of a Vercel deployment failure.

## References

- Google AdSense readiness: https://support.google.com/adsense/answer/7299563?hl=en-EN
- AdSense eligibility: https://support.google.com/adsense/answer/9724?hl=en
- Google Publisher Policies: https://support.google.com/adsense/answer/10502938?hl=en
- Vercel Hobby commercial restrictions: https://vercel.com/docs/limits/fair-use-guidelines
