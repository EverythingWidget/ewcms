/**
 * The count groups of the property pickers (Field.svelte: the label row's picker and its
 * + Property menu; WidgetToolbar.svelte: a text's + Property), in one place:
 *
 *   Count of this List  {items}, how many items the List shows (only on a List widget)
 *   Count of a source   {people}, … how many items each source has
 *
 * Neither is a property of the item (../site/layout/parts.js has the names' order: the item's
 * own property, then {items} on a List, then a source).
 */
export const THIS_LIST = 'Count of this List';
export const SOURCE_COUNTS = 'Count of a source';

/**
 * [{ group, options: [{ value, label, hint }] }]. `listItems`: how many items the widget shows
 * when it is a List (true: a List, count unknown), else null (no Count of this List group). `prefix` goes before each value (the
 * picker's 'p:').
 */
export function countGroups({ lists = [], listItems = null, prefix = '' } = {}) {
  return [
    ...(listItems === null || listItems === undefined
      ? []
      : [
          {
            group: THIS_LIST,
            options: [
              {
                value: `${prefix}items`,
                label: '{items}',
                hint:
                  typeof listItems === 'number'
                    ? `${listItems} ${listItems === 1 ? 'item' : 'items'} it shows`
                    : 'the items it shows',
              },
            ],
          },
        ]),
    ...(lists.length
      ? [
          {
            group: SOURCE_COUNTS,
            options: lists.map((id) => ({
              value: `${prefix}${id}`,
              label: `{${id}}`,
              hint: `items in ${id}`,
            })),
          },
        ]
      : []),
  ];
}
