const SAFE_COLOR_REGEX =
  /^(#[0-9a-f]{3,8}|rgb\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}\s*\)|rgba\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*(0|1|0?\.\d+)\s*\))$/i;
const SAFE_ALIGN_REGEX = /^(left|center|right|justify)$/i;
const SAFE_FONT_SIZE_REGEX = /^(1[0-9]|2[0-9]|3[0-6])px$/i;
const SAFE_LINE_HEIGHT_REGEX = /^(1(\.\d{1,2})?|2(\.[0-5])?)$/;
const SAFE_PARAGRAPH_SPACING_REGEX = /^(0|0px|([1-9]|[1-3][0-9]|4[0-8])px)$/i;
const SAFE_HREF_REGEX = /^(https?:\/\/|mailto:)/i;

const DROP_CONTENT_TAGS = new Set([
  'script',
  'style',
  'iframe',
  'object',
  'embed',
  'svg',
  'math',
  'noscript',
  'template',
  'textarea',
  'title',
  'head',
]);

const VOID_TAGS = new Set(['br', 'hr']);

const INLINE_SINGLE_ALLOWED_TAGS = new Set([
  'strong',
  'b',
  'em',
  'i',
  'u',
  's',
  'del',
  'mark',
  'span',
  'sub',
  'sup',
  'code',
  'a',
]);

// Ringkasan supports inline marks + paragraphs (for text-align left/center/right/justify)
const INLINE_ALLOWED_TAGS = new Set([...INLINE_SINGLE_ALLOWED_TAGS, 'br', 'p']);

const BLOCK_ALLOWED_TAGS = new Set([
  ...INLINE_ALLOWED_TAGS,
  'h2',
  'h3',
  'h4',
  'ul',
  'ol',
  'li',
  'blockquote',
  'pre',
  'hr',
]);

const ALIGNABLE_TAGS = new Set(['p', 'h2', 'h3', 'h4', 'blockquote']);

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function escapeAttr(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&#(\d+);/g, (_m, dec) => {
      const code = Number.parseInt(dec, 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : '';
    })
    .replace(/&#x([0-9a-f]+);/gi, (_m, hex) => {
      const code = Number.parseInt(hex, 16);
      return Number.isFinite(code) ? String.fromCodePoint(code) : '';
    })
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'");
}

function parseAttributes(rawAttrs: string): Record<string, string> {
  const attrs: Record<string, string> = {};
  const attrRegex =
    /([a-zA-Z_:][\w:.-]*)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;
  let match: RegExpExecArray | null;
  while ((match = attrRegex.exec(rawAttrs)) !== null) {
    const name = match[1].toLowerCase();
    const rawVal = match[2] ?? match[3] ?? match[4] ?? '';
    attrs[name] = decodeHtmlEntities(rawVal).trim();
  }
  return attrs;
}

function sanitizeStyleAttribute(tagName: string, rawStyle: string): string | null {
  const allowedProps: string[] = [];
  const declarations = rawStyle.split(';');

  for (const decl of declarations) {
    const colonIdx = decl.indexOf(':');
    if (colonIdx === -1) continue;
    const prop = decl.slice(0, colonIdx).trim().toLowerCase();
    const val = decl.slice(colonIdx + 1).trim();
    if (!prop || !val) continue;

    if (
      (prop === 'color' || prop === 'background-color') &&
      (tagName === 'span' || tagName === 'mark') &&
      SAFE_COLOR_REGEX.test(val)
    ) {
      allowedProps.push(`${prop}: ${val}`);
    } else if (
      prop === 'font-size' &&
      tagName === 'span' &&
      SAFE_FONT_SIZE_REGEX.test(val)
    ) {
      allowedProps.push(`font-size: ${val.toLowerCase()}`);
    } else if (
      prop === 'text-align' &&
      ALIGNABLE_TAGS.has(tagName) &&
      SAFE_ALIGN_REGEX.test(val)
    ) {
      allowedProps.push(`text-align: ${val.toLowerCase()}`);
    } else if (
      prop === 'line-height' &&
      ALIGNABLE_TAGS.has(tagName) &&
      SAFE_LINE_HEIGHT_REGEX.test(val)
    ) {
      allowedProps.push(`line-height: ${val}`);
    } else if (
      prop === 'margin-bottom' &&
      ALIGNABLE_TAGS.has(tagName) &&
      SAFE_PARAGRAPH_SPACING_REGEX.test(val)
    ) {
      allowedProps.push(`margin-bottom: ${val.toLowerCase()}`);
    }
  }

  return allowedProps.length > 0 ? allowedProps.join('; ') : null;
}

function sanitizeHref(rawHref: string): string | null {
  // Remove ASCII control characters and whitespace before scheme validation
  const cleaned = rawHref.replace(/[\u0000-\u001F\u007F\s]+/g, '').trim();
  if (!cleaned || !SAFE_HREF_REGEX.test(cleaned)) return null;
  try {
    const parsed = new URL(cleaned);
    if (
      parsed.protocol === 'http:' ||
      parsed.protocol === 'https:' ||
      parsed.protocol === 'mailto:'
    ) {
      return cleaned;
    }
    return null;
  } catch {
    return null;
  }
}

function unwrapSingleLineParagraphs(html: string): string {
  const trimmed = html.trim();
  if (!trimmed) return '';
  return trimmed
    .replace(/<\/p>\s*<p[^>]*>/gi, ' ')
    .replace(/^<p[^>]*>/i, '')
    .replace(/<\/p>$/i, '')
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function stripDangerousBlocks(html: string): string {
  let result = html.replace(/<!--[\s\S]*?-->/g, '');
  for (const tag of DROP_CONTENT_TAGS) {
    const blockRegex = new RegExp(`<${tag}\\b[^>]*>[\\s\\S]*?<\\/${tag}\\s*>`, 'gi');
    result = result.replace(blockRegex, '');
    const selfClosingRegex = new RegExp(`<${tag}\\b[^>]*\\/?>`, 'gi');
    result = result.replace(selfClosingRegex, '');
  }
  return result;
}

/**
 * Strict, zero-dependency allowlist HTML sanitizer for Rich Text Editor output.
 * - `inline-single`: for Judul (inline formatting only, no block tags or line breaks)
 * - `inline`: for Ringkasan (inline formatting + paragraphs with text-align)
 * - `block`: for Isi Konten (headings, paragraphs, lists, quotes, font-size, line/paragraph spacing, etc.)
 */
export function sanitizeRichTextHtml(
  raw: string | null | undefined,
  mode: 'inline-single' | 'inline' | 'block' = 'block'
): string {
  if (!raw || typeof raw !== 'string') return '';
  const trimmed = raw.trim();
  if (!trimmed) return '';

  const withoutDangerous = stripDangerousBlocks(trimmed);
  const prepared =
    mode === 'inline-single'
      ? unwrapSingleLineParagraphs(withoutDangerous)
      : withoutDangerous;

  const allowedTags =
    mode === 'block'
      ? BLOCK_ALLOWED_TAGS
      : mode === 'inline-single'
      ? INLINE_SINGLE_ALLOWED_TAGS
      : INLINE_ALLOWED_TAGS;

  const openStack: string[] = [];
  const tokenRegex = /(<\/?[a-zA-Z][\w-]*(?:\s[^<>]*?)?\/?>)/g;
  const parts = prepared.split(tokenRegex);
  const output: string[] = [];

  for (const part of parts) {
    if (!part) continue;

    if (!part.startsWith('<')) {
      output.push(escapeHtml(decodeHtmlEntities(part)));
      continue;
    }

    const closingMatch = /^<\/([a-zA-Z][\w-]*)\s*>$/.exec(part);
    if (closingMatch) {
      const tagName = closingMatch[1].toLowerCase();
      if (!allowedTags.has(tagName) || VOID_TAGS.has(tagName)) continue;

      const idx = openStack.lastIndexOf(tagName);
      if (idx !== -1) {
        while (openStack.length > idx) {
          const popped = openStack.pop();
          if (popped) output.push(`</${popped}>`);
        }
      }
      continue;
    }

    const openingMatch = /^<([a-zA-Z][\w-]*)([\s\S]*?)\/?>$/.exec(part);
    if (!openingMatch) continue;

    const tagName = openingMatch[1].toLowerCase();
    const rawAttrs = openingMatch[2] || '';

    if (!allowedTags.has(tagName)) {
      continue;
    }

    if (VOID_TAGS.has(tagName)) {
      output.push(tagName === 'br' ? '<br />' : '<hr />');
      continue;
    }

    const attrs = parseAttributes(rawAttrs);
    const safeAttrStrings: string[] = [];

    if (tagName === 'a') {
      const safeHref = attrs.href ? sanitizeHref(attrs.href) : null;
      if (!safeHref) {
        continue;
      }
      safeAttrStrings.push(`href="${escapeAttr(safeHref)}"`);
      safeAttrStrings.push('target="_blank"');
      safeAttrStrings.push('rel="noopener noreferrer"');
    }

    if (attrs.style) {
      const safeStyle = sanitizeStyleAttribute(tagName, attrs.style);
      if (safeStyle) {
        safeAttrStrings.push(`style="${escapeAttr(safeStyle)}"`);
      }
    }

    if (tagName === 'mark' && attrs['data-color'] && SAFE_COLOR_REGEX.test(attrs['data-color'])) {
      safeAttrStrings.push(`data-color="${escapeAttr(attrs['data-color'])}"`);
    }

    const attrSuffix = safeAttrStrings.length > 0 ? ` ${safeAttrStrings.join(' ')}` : '';
    output.push(`<${tagName}${attrSuffix}>`);
    openStack.push(tagName);
  }

  while (openStack.length > 0) {
    const unclosed = openStack.pop();
    if (unclosed) output.push(`</${unclosed}>`);
  }

  const cleaned = output.join('').trim();

  if (!stripHtmlToPlainText(cleaned)) {
    return '';
  }

  return cleaned;
}

/**
 * Converts HTML (or plain text) into clean plain text for validation, slugs,
 * SEO metadata, alt/aria labels, notifications, and search filtering.
 */
export function stripHtmlToPlainText(raw: string | null | undefined): string {
  if (!raw || typeof raw !== 'string') return '';
  const withoutDangerous = stripDangerousBlocks(raw);
  const withoutTags = withoutDangerous.replace(/<[^>]*>/g, ' ');
  return decodeHtmlEntities(withoutTags).replace(/\s+/g, ' ').trim();
}

function hasHtmlTags(raw: string): boolean {
  return /<\/?[a-z][\w-]*(\s[^>]*)?>/i.test(raw);
}

/**
 * Safely prepares either rich HTML or legacy plain text (with \n line breaks)
 * for rendering with `dangerouslySetInnerHTML`.
 */
export function prepareRichTextHtmlForRender(
  raw: string | null | undefined,
  mode: 'inline-single' | 'inline' | 'block' = 'block'
): string {
  if (!raw || typeof raw !== 'string') return '';
  const trimmed = raw.trim();
  if (!trimmed) return '';

  if (!hasHtmlTags(trimmed)) {
    const escaped = escapeHtml(trimmed);
    if (mode === 'inline-single') {
      return escaped.replace(/\s+/g, ' ').trim();
    }
    if (mode === 'inline') {
      return escaped
        .split(/\r?\n\s*\r?\n/)
        .map((para) => `<p>${para.replace(/\r?\n/g, '<br />')}</p>`)
        .join('');
    }
    return escaped
      .split(/\r?\n\s*\r?\n/)
      .map((para) => `<p>${para.replace(/\r?\n/g, '<br />')}</p>`)
      .join('');
  }

  return sanitizeRichTextHtml(trimmed, mode);
}

export function isRichTextEmpty(raw: string | null | undefined): boolean {
  return stripHtmlToPlainText(raw).length === 0;
}
