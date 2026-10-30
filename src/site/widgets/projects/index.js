/**
 * The built-in Project list widget (projects): a widget module like any custom one (../index.js has
 * the format), its default export the definition.
 */
import { html } from '../../helpers.js';
import { sectionHead, projectList } from '../../templates/partials.js';
import { sourcePage } from '../data.js';

/**
 * The project list (a source's items, rows that open). With a title it has a head
 * and a link to all (the home look); without, it is a page's own list.
 */
export const projects = {
  type: 'projects',
  // added from the editor: Auto, as tall as what it holds
  added: { size: 'auto' },
  list: true,
  label: 'Project list',
  icon: 'list',
  line: 'Rows that open each project',
  sketch: 'projects',
  fields: [
    { key: 'eyebrow', label: 'Label', width: 'half' },
    { key: 'title', label: 'Title (empty: no heading)', width: 'half' },
    { key: 'cta', label: 'Button' },
  ],
  defaults: {
    eyebrow: 'Projects',
    title: 'Things I build',
    cta: 'All projects',
    source: { mode: 'all', from: 'projects' },
    motion: { anim: 'list-up' },
  },
  render: (s, ctx, widget) => {
    const source = widget.source || ''; // None: an empty list
    const list = widget.items;
    const { indexOf } = widget;
    if (!s.title)
      return html` <div class="projectswidget">
        ${projectList(ctx, list, { id: `projects-${widget.id}`, source, headingLevel: 2, indexOf })}
      </div>`;
    return html` <div class="projectswidget">
      ${sectionHead({ at: widget.ed, ...s, href: source && sourcePage(ctx, source) })}
      ${projectList(ctx, list, { id: `projects-${widget.id}`, source, indexOf })}
    </div>`;
  },
};

export default projects;
