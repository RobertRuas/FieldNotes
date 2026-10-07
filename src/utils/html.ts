const PASS = new Set(['P', 'BR', 'B', 'STRONG', 'I', 'EM', 'UL', 'OL', 'LI', 'A', 'SPAN']);
const DROP = new Set(['SCRIPT', 'STYLE', 'IFRAME', 'OBJECT', 'EMBED', 'LINK', 'META']);

export function escapeHtml(text: string): string {
  return text
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

export function htmlToMultilinePlain(html: string): string {
  if (!html) return '';
  const doc = new DOMParser().parseFromString(html, 'text/html');

  function walk(node: Node): string {
    if (node.nodeType === Node.TEXT_NODE) {
      return node.textContent ?? '';
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return '';

    const el = node as HTMLElement;
    const tag = el.tagName;

    if (tag === 'BR') return '\n';

    let text = '';
    for (const child of Array.from(el.childNodes)) {
      text += walk(child);
    }

    if (['P', 'DIV', 'LI', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6'].includes(tag)) {
      return `\n${text}\n`;
    }
    return text;
  }

  const raw = walk(doc.body);
  return raw
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .join('\n');
}

export function htmlToPlain(html: string): string {
  if (!html) return '';
  const doc = new DOMParser().parseFromString(html, 'text/html');
  return (doc.body.textContent ?? '').replace(/\s+/g, ' ').trim();
}

export function plainToHtml(text: string): string {
  const lines = text.replaceAll('\r\n', '\n').split('\n');
  return lines.map((line) => `<p>${escapeHtml(line) || '<br>'}</p>`).join('');
}

function safeHref(raw: string): string | null {
  try {
    const url = new URL(raw, 'https://example.invalid');
    if (url.protocol !== 'http:' && url.protocol !== 'https:' && url.protocol !== 'mailto:') return null;
    if (url.protocol !== 'mailto:' && url.hostname === 'example.invalid') return null;
    return url.href;
  } catch {
    return null;
  }
}

function attributesFor(element: Element): string {
  const tag = element.tagName;
  if (tag === 'A') {
    const href = element.getAttribute('href');
    const safe = href ? safeHref(href) : null;
    return safe ? ` href="${escapeHtml(safe)}"` : '';
  }
  if ((tag === 'UL' || tag === 'OL') && element.classList.contains('fn-check')) {
    return ' class="fn-check"';
  }
  if (tag === 'LI' && element.hasAttribute('data-check')) {
    const checked = element.getAttribute('aria-checked') === 'true';
    return ` data-check="1" role="checkbox" aria-checked="${checked ? 'true' : 'false'}"`;
  }
  if (tag === 'SPAN' && element.hasAttribute('data-box')) {
    return ' data-box="1" contenteditable="false"';
  }
  return '';
}

function sanitizeChildren(parent: Node): string {
  let html = '';
  parent.childNodes.forEach((node) => {
    html += sanitizeNode(node);
  });
  return html;
}

function sanitizeNode(node: Node): string {
  if (node.nodeType === Node.TEXT_NODE) return escapeHtml(node.textContent ?? '');
  if (node.nodeType !== Node.ELEMENT_NODE) return '';
  const element = node instanceof Element ? node : null;
  if (!element) return '';
  const tag = element.tagName;
  if (DROP.has(tag)) return '';
  if (!PASS.has(tag)) return sanitizeChildren(element);
  if (tag === 'BR') return '<br>';
  const attrs = attributesFor(element);
  return `<${tag.toLowerCase()}${attrs}>${sanitizeChildren(element)}</${tag.toLowerCase()}>`;
}

export function sanitizeNoteHtml(input: string): string {
  if (!input.trim()) return '';
  const doc = new DOMParser().parseFromString(input, 'text/html');
  return sanitizeChildren(doc.body);
}

export function normalizeUrl(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const withProtocol = /^[a-z][a-z0-9+.-]*:/i.test(trimmed) ? trimmed : `https://${trimmed}`;
  return safeHref(withProtocol);
}
