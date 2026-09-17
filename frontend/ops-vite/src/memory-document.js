/** Format stored memory as readable Markdown without active HTML or remote media. */
export function createMemoryDocumentRenderer(markdownFactory) {
  const parser = typeof markdownFactory === 'function'
    ? markdownFactory({ html: false, linkify: false, breaks: false, typographer: false })
      .disable(['image', 'link', 'autolink'])
    : null;
  return content => {
    const text = String(content || '');
    if (parser) return parser.render(text);
    const escaped = text.replace(/[&<>"']/g, character => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    })[character]);
    return `<pre>${escaped}</pre>`;
  };
}
