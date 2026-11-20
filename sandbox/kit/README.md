# Mock kit

Pieces for mocks, so a mock only writes the bit it changes. They use the real components from
`src/editor/svelte/` (Section, SectionSettings, Button, Tabs, ExplorerHead) and,
where the app's markup lives inside a component (App's toolbar and footer, SectionsList's
widget rows), that component's own styles, read from its source and compiled in the browser
(`styles.js`). Nothing is copied, so the kit follows the app.

| Piece                                       | What it draws                                                                                                                                                                                                                                                         |
| ------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Panel`                                     | the side panel: status / Edit or Done / Publish, the area open: in Pages a page head (`page`) and its tabs, scroll body, Desktop \| Phone / undo, redo (`area`, `editing`, `tab`, `tabs`, `height`, `changes`, `unpublished`, `phone`)                                |
| `SectionCard`                               | a section card on the sample page: the real SectionCard.svelte (`at`, `selected`, `hover`, `open`, `hoverRow`, `changed`, `red`)                                                                                                                                      |
| `Ask`                                       | the old delete confirm for an `over` snippet (old mocks; `red` shows the real one)                                                                                                                                                                                    |
| `WidgetCard`                                | a widget's row: the real WidgetRow.svelte (`widget`)                                                                                                                                                                                                                  |
| `Modal`                                     | a modal shell in place: `.modal__box` + ExplorerHead, body, `foot` snippet                                                                                                                                                                                            |
| `Compare` / `Variant`                       | a title and labelled variants side by side (`cols`, `width`; `label`, `note`)                                                                                                                                                                                         |
| `sampleLive()`, `SECTIONS`, `PAGES`, `FILE` | sample data: a six-section page in a real store / live state                                                                                                                                                                                                          |
| `samplePage`, `widget`                      | ready-made pages `short`, `full`, `states`: `sampleLive('full')` (indices in `sample.js`, `../MOCKUP-PROTOCOL.md`)                                                                                                                                                    |
| `EditorState`, `editorState()`              | made-up editor and preview state on the real state modules (`state.js`): `path` (the preview's page: its row's active fill), `pages` (made-up pages: a number or `'many'`), `widget` (selected), `update` (`'available'` \| `'up-to-date'`), `panel`, `mode`, `files` |
| `siteFiles()`, `withPages()`, `hold()`      | the dev server's content (as the editor loads it), content plus N made-up pages (half linked), hold the screenshot for a promise (`ready.js`)                                                                                                                         |

## Example

```svelte
<!-- sandbox/mocks/my-idea.svelte -->
<script>
  import { Compare, Variant, SectionCard, sampleLive } from '../kit/index.js';
  const live = sampleLive();
</script>

<Compare title="My idea" cols={2}>
  <Variant label="Now"><SectionCard {live} at={2} /></Variant>
  <Variant label="A" note="Selected, its widgets open, its delete confirm below">
    <SectionCard {live} at={2} selected open />
    <SectionCard {live} at={5} red />
  </Variant>
</Compare>
```

## Editor state

The real components that read the editor's state (the pages list, the About card, the
section cards' selection) draw made-up state from `EditorState`. It sets the real `ui` and
update state (`src/editor/svelte/ui.svelte.js`, `update.svelte.js`) and builds the page menu
with the editor's own `src/editor/lib/page-entries.js`, so nothing is copied:

```svelte
<script>
  import { EditorState } from '../kit/index.js';
  import PagesList from '../../src/editor/svelte/PagesList.svelte';
  const actions = { pickTarget() {}, setPanel() {}, pagesOp: async () => ({}) };
</script>

<EditorState path="/about/" pages="many" update="available" widget="w-ab7l">
  {#snippet children(live)}<PagesList {live} {actions} />{/snippet}
</EditorState>
```

Without `files` it loads the dev server's content (`GET /__editor/content`, the site
`npm run mock` serves) and the screenshot waits for it. `editorState({ … })` is the same as a
function (sync, `files` given) that returns the live state. `ui` is one per page: mocks stacked
on one page share it. Its props make good variants: one mock, a PNG per state
(`../README.md`, Variants).

Then `npm run mock -- my-idea --bare` (see `../README.md`). `kit-demo` (`demo.svelte`) shows every piece.
