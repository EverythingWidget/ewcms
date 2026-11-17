// site.json lang in the editor (src/editor/lib/languages.js): one list, the missing-folder hint.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { languageOptions, langHint } from '../src/editor/lib/languages.js';

test('languages: one list (with a site own lang), a hint when its folder is not the one in use', () => {
  assert.equal(languageOptions()[0].value, 'en');
  assert.equal(languageOptions('nl').length, languageOptions().length);
  assert.equal(languageOptions('nl-BE').at(-1).value, 'nl-BE');
  assert.equal(langHint('en'), '');
  assert.equal(langHint('en-GB'), '');
  assert.match(
    langHint('de'),
    /^Uses content\/en\/ until content\/de\/ exists and ewcms dev restarts\.$/,
  );
});
