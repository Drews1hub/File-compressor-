// Rebuild book markup from a small allowlist; never copy active attributes or embeds.
const TAGS = new Set('p br div span section article h1 h2 h3 h4 h5 h6 em strong b i u s small sub sup blockquote pre code ul ol li dl dt dd table thead tbody tfoot tr th td hr a img'.split(' '));
export function sanitizeBookHtml(html) {
  const template = document.createElement('template');
  template.innerHTML = html;
  const out = document.createElement('div');
  function copy(node, parent) {
    if (node.nodeType === 3) { parent.append(document.createTextNode(node.textContent)); return; }
    if (node.nodeType !== 1) return;
    const tag = node.localName.toLowerCase();
    if (['script', 'style', 'iframe', 'object', 'embed', 'svg', 'math', 'template', 'form', 'input', 'meta', 'link', 'base'].includes(tag)) return;
    if (!TAGS.has(tag)) { for (const child of node.childNodes) copy(child, parent); return; }
    const el = document.createElement(tag);
    for (const name of ['id', 'title', 'lang']) {
      if (node.hasAttribute(name)) el.setAttribute(name, node.getAttribute(name));
    }
    if (['td', 'th'].includes(tag)) {
      for (const name of ['colspan', 'rowspan']) {
        const value = node.getAttribute(name);
        if (/^[1-9][0-9]{0,2}$/.test(value || '')) el.setAttribute(name, value);
      }
    }
    if (tag === 'img') {
      const src = node.getAttribute('src') || '';
      // SVG and remote images can contain active content or track readers.
      if (!/^data:image\/(?:png|jpeg|gif|webp);base64,[a-z0-9+/=\s]+$/i.test(src)) return;
      el.setAttribute('src', src);
      el.setAttribute('alt', node.getAttribute('alt') || '');
    }
    if (tag === 'a') {
      const href = (node.getAttribute('href') || '').trim();
      if (/^(?:https?:\/\/|mailto:|#)/i.test(href) && !/[\u0000-\u0020\u007f]/.test(href)) el.setAttribute('href', href);
      el.setAttribute('rel', 'noopener noreferrer');
    }
    for (const child of node.childNodes) copy(child, el);
    parent.append(el);
  }
  for (const node of template.content.childNodes) copy(node, out);
  return out.innerHTML;
}
