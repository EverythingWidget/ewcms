/**
 * The editor's data layer, one per editor tab: main.js, the Publish window and the panels load,
 * save, check the status and publish through it, never with their own fetch calls.
 */
import { createLocalDataLayer } from './local-data-layer.js';

export const dataLayer = createLocalDataLayer();
