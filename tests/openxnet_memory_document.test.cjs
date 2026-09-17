const test = require('node:test');
const assert = require('node:assert/strict');
const markdownit = require('../static/libs/markdown-it.min.js');

test('memory documents retain headings, paragraphs, lists and literal code', async () => {
  const { createMemoryDocumentRenderer } = await import('../frontend/ops-vite/src/memory-document.js');
  const html = createMemoryDocumentRenderer(markdownit)('# Recovery\n\nFirst paragraph.\n\n- Evidence\n- Result\n\n```text\n<example>\n```');
  assert.match(html, /<h1>Recovery<\/h1>/);
  assert.match(html, /<p>First paragraph\.<\/p>/);
  assert.match(html, /<li>Evidence<\/li>/);
  assert.match(html, /&lt;example&gt;/);
});

test('stored content cannot create executable HTML, links or remote images', async () => {
  const { createMemoryDocumentRenderer } = await import('../frontend/ops-vite/src/memory-document.js');
  const payload = '<script>alert(1)</script>\n\n<img src=x onerror=alert(1)>\n\n![pixel](https://example.invalid/pixel)\n\n[link](javascript:alert(1))\n\n<https://example.invalid/>\n\n[remote](https://example.invalid/)';
  for (const factory of [markdownit, null]) {
    const html = createMemoryDocumentRenderer(factory)(payload);
    assert.doesNotMatch(html, /<(?:script|img|iframe|a)\b/i);
    assert.match(html, /&lt;script&gt;/);
  }
});
