import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkBody, renderBody, splitLine, tidyBody, toggleFit } from '../src/site/text.js';
import { scaleFactor } from '../src/client/modules/fit.js';
import { convert } from './rename-0-2-0.mjs';

const L = (t, style = 'title', more = {}) => ({ style, ...more, text: [{ t }] });

test('Fit width: a line\'s "fit" (any style), toggled on the caret\'s line', () => {
  const body = [L('Noor'), L('Amsterdam', 'paragraph')];
  const on = toggleFit(body, 1);
  assert.equal(on[1].fit, true);
  assert.equal(on[0].fit, undefined); // only that line
  assert.equal(body[1].fit, undefined); // not in place
  assert.equal(toggleFit(on, 1)[1].fit, undefined); // off: its style's size
  assert.deepEqual(checkBody(on), []);
  assert.match(checkBody([L('a', 'title', { fit: 'yes' })])[0], /\.fit" must be true/);
  const html = renderBody(on);
  assert.match(html, /class="ts ts--paragraph" data-line="paragraph" data-fit>Amsterdam/);
  assert.doesNotMatch(html, /ts--title"[^>]*data-fit/);
  // kept by tidying and by a split mid-line; Enter at the end of a title: a plain paragraph
  assert.equal(tidyBody(on)[1].fit, true);
  const s = splitLine([L('Noor', 'statement', { fit: true })], { line: 0, at: 2 });
  assert.deepEqual(
    s.map((l) => l.fit),
    [true, true],
  );
  const e = splitLine([L('Noor', 'title', { fit: true })], { line: 0, at: 4 });
  assert.equal(e[1].style, 'paragraph');
  assert.equal(e[1].fit, undefined);
});

test('Scale to fit: shrink only, by width and (a fixed height) height', () => {
  assert.equal(scaleFactor(400, 300, 100), 1); // fits: its normal size
  assert.equal(scaleFactor(400, 800, 100), 0.497); // twice too wide: half, a hair under
  assert.equal(scaleFactor(400, 400, 400, 200), 0.497); // twice too tall in a fixed height
  assert.equal(scaleFactor(400, 400, 100, 200), 1);
  // a fit line's height doesn't scale: only the rest has to fit
  assert.equal(scaleFactor(400, 400, 300, 200, 100), 0.497);
  assert.equal(scaleFactor(0, 400, 100), 1);
  assert.equal(scaleFactor(10, 100000, 10), 0.05); // never below
});

test('rename 0.2.0: a Text widget\'s whole-widget "fit" -> Scale to fit ("scale"); idempotent', () => {
  const files = () => [
    {
      rel: 'en/pages/index.json',
      data: {
        sections: [
          {
            id: 's-aaaa',
            widgets: [
              { id: 'w-aaaa', type: 'text', fit: true, body: [L('A'), L('b', 'paragraph')] },
              { id: 'w-bbbb', type: 'text', body: [L('C')] },
              { id: 'w-cccc', type: 'button', fit: true, label: 'Go' },
              { id: 'w-dddd', type: 'text', fit: false, body: [L('D')] },
            ],
          },
        ],
      },
    },
  ];
  const f = files();
  const notes = convert(f)
    .flatMap((s) => s.notes)
    .join('\n');
  const [a, b, c, d] = f[0].data.sections[0].widgets;
  assert.equal(a.scale, true);
  assert.deepEqual(
    a.body.map((l) => l.fit),
    [undefined, undefined],
  );
  assert.equal('fit' in a, false);
  assert.equal('scale' in b, false);
  assert.equal('scale' in c, false);
  assert.equal('scale' in d, false);
  assert.equal(b.body[0].fit, undefined);
  assert.equal('fit' in c, false);
  assert.equal('fit' in d, false);
  assert.equal(d.body[0].fit, undefined);
  assert.match(notes, /2 text widgets' "fit" -> "scale" \(Scale to fit\)/);
  assert.match(notes, /1 widget' "fit" dropped/);
  const again = structuredClone(f);
  convert(again);
  assert.deepEqual(again, f);
});
