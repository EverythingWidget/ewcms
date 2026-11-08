<!--
  A template widget's place on the template's grid (src/site/widgets/list/item-grid.js), as a
  page widget's: its columns and row on the 120-column grid, its size (Auto: as tall as its
  content, pushing the widgets that follow it down), what it follows (a link and its gap), its
  layer, and an own phone layout (60 columns; without one the desktop layout is scaled down).
  TemplatePanel.svelte shows it for every top-level widget.
-->
<script>
  import Field from './Field.svelte';
  import { ASPECTS } from '../../site/layout/index.js';
  import { stackName } from '../lib/item-template.js';

  /** @type {{ file: string, b: string, w: any, widgets: any[], set: Function }} */
  let { file, b, w, widgets, set } = $props();

  const base = $derived(w.layout?.base || {});
  const phone = $derived(w.layout?.phone || null);
  const size = $derived(w.size || 'auto');
  const SIZES = [
    ['auto', 'Auto: as tall as its content'],
    ['aspect', 'Aspect: its width × a ratio'],
    ['rows', 'Rows: fixed'],
  ];
  const ASPECT_OPTIONS = ASPECTS.map((a) => [a, a]);
  // what it can follow: the other widgets of the template
  const leaders = $derived([
    ['', 'Nothing: it stays at its row'],
    ...widgets
      .filter((x) => x?.id && x.id !== w.id)
      .map((x) => [x.id, `${stackName(x)} (${x.id})`]),
  ]);
  const whole = (v, min, max) => {
    const n = Math.round(Number(v));
    return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : min;
  };
  const setBase = (key, v) => set(`${b}/layout/base`, { ...base, [key]: v }, true);
  function setSize(v) {
    set(`${b}/size`, v === 'auto' ? undefined : v, true);
    if (v === 'aspect' && !w.aspect) set(`${b}/aspect`, '4:5', true);
    if (v !== 'aspect') set(`${b}/aspect`, undefined, true);
    // rows are stored only for Aspect and Rows (an Auto widget's are measured on the page)
    if (v === 'auto') {
      const { rows: _r, ...rest } = base; // eslint-disable-line no-unused-vars
      set(`${b}/layout/base`, rest, true);
    } else if (!base.rows) setBase('rows', 24);
  }
  function setLink(to) {
    const { link: _l, ...rest } = base; // eslint-disable-line no-unused-vars
    set(`${b}/layout/base`, to ? { ...rest, link: { to, gap: base.link?.gap ?? 2 } } : rest, true);
  }
  function setPhone(on) {
    const half = (n) => Math.max(1, Math.ceil((n || 1) / 2));
    set(
      `${b}/layout/phone`,
      on
        ? {
            col: Math.floor(((base.col || 1) - 1) / 2) + 1,
            span: half(base.span || 120),
            row: half(base.row || 1),
            ...(base.rows ? { rows: half(base.rows) } : {}),
          }
        : undefined,
      true,
    );
  }
  const setPhoneKey = (key, v) => set(`${b}/layout/phone`, { ...phone, [key]: v }, true);
</script>

<div class="tg" data-template-grid>
  <Field
    edit={`${file}#${b}/layout/base/col`}
    label="Column"
    type="number"
    value={base.col ?? 1}
    onvalue={(v) => setBase('col', whole(v, 1, 120))}
  />
  <Field
    edit={`${file}#${b}/layout/base/span`}
    label="Columns"
    type="number"
    value={base.span ?? 121 - (base.col ?? 1)}
    onvalue={(v) => setBase('span', whole(v, 1, 121 - (base.col ?? 1)))}
  />
  <Field
    edit={`${file}#${b}/layout/base/row`}
    label="Row"
    type="number"
    value={base.row ?? 1}
    disabled={!!base.link}
    help={base.link ? 'It follows another widget' : ''}
    onvalue={(v) => setBase('row', whole(v, 1, 999))}
  />
  <Field
    edit={`${file}#${b}/size`}
    label="Height"
    type="select"
    value={size}
    options={SIZES}
    onvalue={setSize}
  />
  <Field
    edit={`${file}#${b}/aspect`}
    label="Ratio"
    type="select"
    value={w.aspect || '4:5'}
    options={ASPECT_OPTIONS}
    disabled={size !== 'aspect'}
    onvalue={(v) => set(`${b}/aspect`, v, true)}
  />
  <Field
    edit={`${file}#${b}/layout/base/rows`}
    label="Rows"
    type="number"
    value={base.rows ?? ''}
    disabled={size !== 'rows'}
    onvalue={(v) => setBase('rows', whole(v, 1, 999))}
  />
  <Field
    edit={`${file}#${b}/layout/base/link`}
    label="Follows"
    type="select"
    value={base.link?.to || ''}
    options={leaders}
    onvalue={setLink}
  />
  <Field
    edit={`${file}#${b}/layout/base/link/gap`}
    label="Rows between"
    type="number"
    value={base.link?.gap ?? ''}
    disabled={!base.link}
    onvalue={(v) => setBase('link', { ...base.link, gap: whole(v, -999, 999) })}
  />
  <Field
    edit={`${file}#${b}/layer`}
    label="Layer"
    type="number"
    value={w.layer ?? 0}
    onvalue={(v) => set(`${b}/layer`, whole(v, -99, 99) || undefined, true)}
  />
  <Field
    edit={`${file}#${b}/layout/phone`}
    label="Own phone layout"
    type="boolean"
    value={!!phone}
    help={phone ? '' : 'Off: the desktop layout, scaled down'}
    onvalue={setPhone}
  />
  <Field
    edit={`${file}#${b}/layout/phone/col`}
    label="Phone column"
    type="number"
    value={phone?.col ?? ''}
    disabled={!phone}
    onvalue={(v) => setPhoneKey('col', whole(v, 1, 60))}
  />
  <Field
    edit={`${file}#${b}/layout/phone/span`}
    label="Phone columns"
    type="number"
    value={phone?.span ?? ''}
    disabled={!phone}
    onvalue={(v) => setPhoneKey('span', whole(v, 1, 61 - (phone?.col ?? 1)))}
  />
  <Field
    edit={`${file}#${b}/layout/phone/row`}
    label="Phone row"
    type="number"
    value={phone?.row ?? ''}
    disabled={!phone}
    onvalue={(v) => setPhoneKey('row', whole(v, 1, 999))}
  />
</div>

<style lang="scss">
  .tg {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: var(--gap-rows) var(--space-2);
  }
</style>
