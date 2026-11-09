<!--
  One field: a label (name, and, changed, a dot before it;, for a value from a source list, a button naming
  its file, e.g. people.json, that opens it in the Source Explorer) with an input, or a
  textarea for longer text, a switch (boolean) or a Select (select, options [[value, label]]).
  bare: no label row (label is the input's aria-label; say it in the placeholder); help: a hint under it; half: it shares a row with the next field (the parent's grid).
  type 'photo': a photo (its media/ path or R2 key) as a 64px card: the photo, its label
  (inside), file name and sizes, Media and ✕ (clears it; remove: the parent's, a list item's);
  grab: a pointerdown on the photo (a list's drag handle, PhotoList.svelte); the thumbnail or Change opens the Media window on it (MediaModal.svelte), which
  stores the photo picked there in this field: one undo step. No text input.
  Used by the Nav panel, the Sources modal and Settings.
  Bindings (a widget's setting: parts, src/site/layout/parts.js):
    binds     the item's properties this one can show, [{ value, label, hint }] (null: it can't
              bind). A picker at the end of the label row: Custom (its own text: what it showed
              becomes it), one of them (stores [{ "property": "<name>" }]) or, a text field,
              Text with properties (typed words and chips, a + Property menu); `from` names the
              item in the picker's group
    formats   a text field: its input holds chips (PartsInput.svelte): typing {name} is the
              same as picking it; `lists` (the sources: {people} shows how many) are offered
              too, `names` (properties and sources) are the names that aren't a warning chip;
              `listItems` (a List's: how many items it shows, else null) offers {items} under
              Count of this List (../property-groups.js)
    A whole value of another type (a photo, a number) is the item's, dimmed and read only.
-->
<script>
  import { parseInput as parseValue } from '../../site/property-types.js';
  import { isParts, isWhole } from '../../site/layout/parts.js';
  import PartsInput from './PartsInput.svelte';
  import { partOfName } from '../lib/parts-input.js';
  import { showValue } from '../lib/show-value.js';
  import Button from './Button.svelte';
  import Select from './Select.svelte';
  import { countGroups } from '../property-groups.js';
  import Position from './Position.svelte';
  import { baseName } from '../../site/files.js';
  import { fallback, openMedia, photoInfo, photoLine, thumbUrl } from './media.svelte.js';

  // edit: the field's data-edit ("file#/pointer"), also on the label so others can find it.
  // type: 'text' | 'words' | 'number' | 'date' | 'multiline' | 'photo' | 'boolean' | 'select' |
  // 'seg' (options as a button group, like Source; unset: the option shown when unset) |
  // 'spot' (nine options, row by row: a Position.svelte, its 3 x 3 grid in a popover; a photo's position).
  // onvalue(value) gets every valid input.
  // source: the content/en/sources/ file the value comes from ('' for the page's own), with
  // onsource() opening it.
  let {
    edit,
    label,
    value,
    type = 'text',
    source = '',
    onsource,
    placeholder = '',
    help = '',
    half = false,
    options = [],
    unset = '',
    changed = false,
    selected = false,
    onfocus,
    onvalue,
    binds = null,
    from = '',
    formats = false,
    lists = [],
    listItems = null,
    names = null,
    resolved = '',
    bare = false,
    grab = null,
    remove = null,
    disabled = false,
  } = $props();

  const uid = $props.id();
  let invalid = $state(false);
  const photo = $derived(type === 'photo');
  // a label element around an input, a switch; photos and Selects label their own buttons
  const tag = $derived(
    photo || type === 'select' || type === 'seg' || type === 'spot' || bound || chips
      ? 'div'
      : 'label',
  );
  // a photo's label goes inside its card, unless the label row has more (a picker, a file)
  const inner = $derived(photo && !bound && !binds && !source);

  /** Show the stored value, except while the user is typing in the field. */
  const show = (value) => showValue(String(value ?? ''));

  function oninput(e) {
    const next = parseValue(type, e.currentTarget.value);
    invalid = next === undefined;
    if (!invalid) onvalue(next);
  }

  // ---- bindings: a value with properties (parts)
  const parts = $derived(isParts(value));
  // an outer item's ({ of: "parent" }): "parent:title", as its option's value
  const whole = $derived(
    isWhole(value) ? (value[0].of === 'parent' ? 'parent:' : '') + value[0].property : null,
  );
  // a text field holds chips (PartsInput); any other type's field shows the item's, read only
  const chips = $derived(!!binds && formats);
  const bound = $derived(parts && !chips);
  const bindOptions = $derived.by(() => {
    const list = binds || [];
    return whole &&
      !list.some((o) => o.value === whole) &&
      !lists.includes(whole) &&
      !(listItems !== null && whole === 'items')
      ? [...list, { value: whole, label: `{${whole}} (missing)` }]
      : list;
  });
  const CUSTOM = ''; // the picker's value for the field's own text
  const MIXED = '\u0000mixed'; // Text with properties
  let mixed = $state(false); // Text with properties picked, no property in it yet
  const pickValue = $derived(
    parts && !whole ? MIXED : whole ? `p:${whole}` : mixed && chips ? MIXED : CUSTOM,
  );
  const pickOptions = $derived([
    { group: '', options: [{ value: CUSTOM, label: 'Custom', hint: 'your own text' }] },
    ...(bindOptions.length
      ? [
          {
            group: from ? `From the item · ${from}` : 'From the item',
            options: bindOptions.map((o) => ({
              ...o,
              value: `p:${o.value}`,
              label: `{${o.label}}`,
            })),
          },
        ]
      : []),
    ...(chips ? countGroups({ lists, listItems, prefix: 'p:' }) : []),
    ...(chips
      ? [
          {
            group: '',
            options: [{ value: MIXED, label: 'Text with properties', hint: 'type {name}' }],
          },
        ]
      : []),
  ]);
  // Custom: what it showed becomes its own text; a property: [{ property }]; Text with
  // properties: the text kept, a + Property menu
  function pick(v) {
    mixed = v === MIXED;
    if (v === MIXED) return;
    if (v === CUSTOM)
      return onvalue(typeof resolved === 'string' && parts ? resolved : parts ? '' : (value ?? ''));
    onvalue([partOfName(v.slice(2))]);
  }
  const add = { insert: null }; // PartsInput's: a chip at its caret
  const addOptions = $derived([
    ...(bindOptions.length
      ? [
          {
            group: 'From the item',
            options: bindOptions.map((o) => ({ ...o, label: `{${o.label}}` })),
          },
        ]
      : []),
    ...countGroups({ lists, listItems }),
  ]);

  function change() {
    onfocus?.();
    openMedia({ key: value || '', pick: edit });
  }
</script>

<!-- a photo has no input to label: a div, its buttons say what they do -->
<svelte:element
  this={tag}
  for={tag === 'label' && type !== 'boolean' ? uid : undefined}
  class={[
    'tf',
    changed && 'is-changed',
    selected && 'is-selected',
    half && 'is-half',
    disabled && 'is-disabled',
  ]}
  data-edit={edit}
>
  {#if !bare && !inner}<span class="tf__label">
      {#if binds}<span class="tf__name">{label}</span>{:else}{label}{/if}
      {#if type === 'boolean'}
        <input
          type="checkbox"
          class="switch"
          checked={!!value}
          {disabled}
          {onfocus}
          onchange={(e) => onvalue(e.currentTarget.checked)}
        />
      {/if}
      {#if binds}
        <span class={['tf__pick', parts && 'is-bound']}>
          <Select
            compact
            aria-label="{label}: its value"
            value={pickValue}
            options={pickOptions}
            onchange={pick}
          >
            {#snippet selected(o)}{#if o.value !== CUSTOM}<i
                  class="fa-solid fa-link"
                  aria-hidden="true"
                ></i>{/if}{o.label}{/snippet}
          </Select>
        </span>
      {/if}
      {#if source}
        <Button
          size="small"
          title="Edit in the Source Explorer: content/{source}"
          onclick={onsource}
        >
          {baseName(source)}
        </Button>
      {/if}
    </span>{/if}
  {#if bound}
    <!-- the item's value: dimmed, not typed in (Custom to write one) -->
    <div
      class="tf__bound"
      id={uid}
      aria-readonly="true"
      title="From the item’s {whole} (read only): Custom to write your own"
    >
      {#if photo && resolved}<img
          src={thumbUrl(resolved)}
          alt=""
          {@attach fallback(resolved)}
        />{/if}
      <span>{resolved || `{${whole}}`}</span>
      <i class="fa-solid fa-lock" aria-hidden="true"></i>
    </div>
  {:else if chips}
    <PartsInput
      id={uid}
      {value}
      {names}
      {label}
      multiline={type === 'multiline'}
      {placeholder}
      {onfocus}
      {onvalue}
      ref={add}
    />
    {#if pickValue === MIXED && addOptions.length}
      <span class="tf__add">
        <Select
          compact
          aria-label="{label}: add a property"
          value=""
          placeholder="+ Property"
          options={addOptions}
          onchange={(v) => v && add.insert?.(v)}
        />
      </span>
    {/if}
  {:else if photo}
    <div class={['photo', !value && 'is-empty']}>
      <button
        type="button"
        class={['photo__thumb', grab && 'is-grab']}
        aria-label={value ? `Change ${label}: ${photoInfo(value).name}` : `Choose ${label}`}
        title={grab ? 'Drag to move (Alt+↑/↓), click to change' : undefined}
        aria-keyshortcuts={grab ? 'Alt+ArrowUp Alt+ArrowDown' : undefined}
        onpointerdown={grab}
        onclick={change}
      >
        {#if value}
          <img src={thumbUrl(value)} alt="" draggable="false" {@attach fallback(value)} />
        {:else}
          <i class="fa-solid fa-plus" aria-hidden="true"></i>
        {/if}
      </button>
      <span class="photo__info">
        {#if inner && !bare}<span class="photo__label">{label}</span>{/if}
        <span class="photo__name" title={value}>{value ? photoInfo(value).name : 'No photo'}</span>
        {#if value}<span class="photo__meta">{photoLine(value)}</span>{/if}
      </span>
      <Button
        icon="images"
        iconOnly
        label={value ? `Change ${label} in Media` : `Choose ${label} in Media`}
        onclick={change}
      />
      {#if remove || value}
        <Button
          icon="xmark"
          iconOnly
          label="Remove {label}"
          onclick={remove ?? (() => onvalue(''))}
        />
      {/if}
    </div>
  {:else if type === 'seg'}
    <div class="seg" role="radiogroup" aria-label={label}>
      {#each options as [v, text] (v)}
        {@const on = (value || unset) === v}
        <button
          type="button"
          role="radio"
          aria-checked={on}
          class={['seg__btn', on && 'is-active']}
          onclick={() => {
            onfocus?.();
            onvalue(v);
          }}>{text}</button
        >
      {/each}
    </div>
  {:else if type === 'spot'}
    <Position {options} {value} {unset} {label} id={uid} {onfocus} onchange={onvalue} />
  {:else if type === 'select'}
    <Select
      id={uid}
      aria-label={label}
      value={value ?? ''}
      placeholder="Pick…"
      {disabled}
      options={options.map(([v, text, more]) => ({ value: v, label: text, ...more }))}
      onchange={(v) => onvalue(v)}
    />
  {:else if type === 'boolean'}
    <!-- the switch is in the label row -->
  {:else if type === 'multiline'}
    <textarea
      id={uid}
      class={['tf__input', invalid && 'is-invalid']}
      {placeholder}
      {@attach show(value)}
      {onfocus}
      {oninput}></textarea>
  {:else}
    <input
      id={uid}
      class={['tf__input', invalid && 'is-invalid']}
      type={type === 'number' || type === 'date' ? type : 'text'}
      aria-label={bare ? label : undefined}
      spellcheck={type !== 'number'}
      {placeholder}
      {@attach show(value)}
      {onfocus}
      {oninput}
    />
  {/if}
  {#if help}<span class="tf__help">{help}</span>{/if}
</svelte:element>

<style lang="scss">
  @use '../styles/mixins' as *;

  // a setting that can't be used now (a List's Columns in Rows): greyed out, same size
  .tf.is-disabled {
    opacity: var(--o-disabled);
    // keep the pre-brighten fill so disabled fields still read as dimmer than enabled ones
    --field-bg: var(--field-bg-dim);
  }

  // with a picker the label gives up the room first
  .tf__name {
    @include ellipsis;
    min-width: 0;
  }

  // the value picker at the end of the label row (Select compact); bound: the widget accent
  .tf__pick {
    @include row(0);
    flex: none;
    justify-content: flex-end;
    max-width: 70%;
    margin-left: auto;
    border-radius: var(--radius-md);
    background: var(--field-bg);
    color: var(--text-quiet);

    &.is-bound {
      color: var(--c-widget-accent);
    }

    i {
      margin-right: var(--space-1);
      font-size: var(--fs-2xs);
    }
  }

  // a bound setting's value: what the preview shows, dimmed, a lock at its end; 32px
  .tf__bound {
    @include row(var(--space-2));
    @include muted;
    height: var(--size-control);
    padding: 0 var(--space-2);
    border-radius: var(--radius-md);
    background: var(--field-bg);
    box-shadow: inset 0 0 0 1px var(--c-line);
    cursor: default;

    span {
      @include ellipsis;
      flex: 1;
    }

    img {
      flex: none;
      width: 24px;
      height: 24px;
      border-radius: var(--radius-sm);
      object-fit: cover;
      opacity: 0.7;
    }

    i {
      flex: none;
      color: var(--c-text-faint);
      font-size: var(--fs-2xs);
    }
  }

  // Text with properties: + Property under the input, at its start
  .tf__add {
    @include row(0);
    margin-top: var(--space-2);
  }

  // a photo: a card as an input (its background, line, 8px corners), 64px in every state:
  // the photo its full height on the left (a + tile when empty; a list's drag handle), its
  // label, file name and sizes, then Media (change) and ✕ (remove), icon-only
  .photo {
    @include row(var(--space-3));
    height: 64px;
    padding-right: var(--space-2);
    border-radius: var(--radius-md);
    overflow: hidden;
    background: var(--field-bg);
    box-shadow: inset 0 0 0 1px var(--c-line);
  }

  .photo__thumb {
    flex: none;
    display: grid;
    place-items: center;
    width: 64px;
    height: 64px;
    padding: 0;
    border: 0;
    border-radius: var(--radius-md) 0 0 var(--radius-md);
    overflow: hidden;
    cursor: pointer;
    color: var(--text-quiet);
    background: var(--field-tile);
    font-size: var(--fs-lg);
    transition: background 0.2s;

    &.is-grab {
      cursor: grab;
    }

    &:hover {
      color: var(--c-text);
      background: var(--c-control-hover);
    }

    &:hover img {
      filter: brightness(1.15);
    }

    &:focus-visible,
    .is-selected & {
      @include focus-ring;
    }

    img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      -webkit-user-drag: none;
    }
  }

  .photo__info {
    flex: 1;
    min-width: 0;
    display: grid;
    font-size: var(--fs-base);
    line-height: 16px;
  }

  // (changed: the dot before it, editor.scss)
  .photo__label {
    @include row(var(--space-2));
    @include muted;
    color: var(--text-quiet);
  }

  .photo__label,
  .photo__name,
  .photo__meta {
    @include ellipsis;
  }

  .photo__name {
    color: var(--c-text-strong);
    font-weight: 500;

    .is-empty & {
      color: var(--c-text-muted);
      font-weight: 400;
    }
  }

  .photo__meta {
    @include muted;
    color: var(--text-quiet);
  }
</style>
