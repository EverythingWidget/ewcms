/**
 * Test fixtures: small sites the tests read instead of the live site's content.
 *
 *   SITE_A  test/fixtures/site-a: content/ with site.json, header.json, footer.json,
 *           animations.json, photos.json and redirects.json at the root, en/ (pages,
 *           sources, strings.json), and .generated/media.json (the media manifest),
 *           a frozen copy of a real site. Tests that change files copy it to a temp
 *           folder first; it is never written to.
 *   SITE_B  test/fixtures/site-b: site A plus a widget of its own, widgets/quote (index.js,
 *           style.scss, client.js), listed in its ewcms.config.mjs; used on its about page.
 */
import { fileURLToPath } from 'node:url';

export const SITE_A = fileURLToPath(new URL('./site-a', import.meta.url));

/**
 * Content (a loadContent result) whose people have a "photo" too (the fixtures name it
 * "cover"): a List's presets show the property of each role's own name, no mapping.
 */
export const withPhoto = (content) => ({
  ...content,
  sources: {
    ...content.sources,
    people: content.sources.people.map((p) => ({ ...p, photo: p.cover })),
  },
  schemas: {
    ...content.schemas,
    people: {
      ...content.schemas.people,
      properties: [...content.schemas.people.properties, { key: 'photo', type: 'photo' }],
    },
  },
});

/** Site B: site A with a widget of its own (widgets/quote, listed in its ewcms.config.mjs). */
export const SITE_B = fileURLToPath(new URL('./site-b', import.meta.url));
