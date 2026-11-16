/**
 * The site's own widgets (ewcms.config.mjs widgets) in the editor's registry, before anything
 * reads it: main.js imports this first. Their definitions come from the dev server
 * (virtual:site-widgets, src/cli/site-widgets.mjs); fields, defaults, labels and icons are all
 * the editor needs: the Add widget modal, the inspector, Motion and the toolbars read them.
 */
import defs from 'virtual:site-widgets';
import { registerWidgets } from '../render/widgets/index.js';

registerWidgets(defs);
