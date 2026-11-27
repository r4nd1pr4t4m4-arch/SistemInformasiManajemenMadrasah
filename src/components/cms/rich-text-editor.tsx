'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Extension } from '@tiptap/core';
import { EditorContent, useEditor, type Extensions } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import TextAlign from '@tiptap/extension-text-align';
import Placeholder from '@tiptap/extension-placeholder';
import { FontSize, TextStyle } from '@tiptap/extension-text-style';
import Color from '@tiptap/extension-color';
import Highlight from '@tiptap/extension-highlight';
import {
  ALargeSmall,
  AlignCenter,
  AlignJustify,
  AlignLeft,
  AlignRight,
  ArrowUpDown,
  Bold,
  Check,
  ChevronDown,
  Code,
  Heading2,
  Heading3,
  Highlighter,
  Italic,
  Link2,
  List,
  ListOrdered,
  Minus,
  Palette,
  Quote,
  Redo2,
  RemoveFormatting,
  Strikethrough,
  Underline as UnderlineIcon,
  Undo2,
  Unlink,
  X,
} from 'lucide-react';
import {
  prepareRichTextHtmlForRender,
  sanitizeRichTextHtml,
  stripHtmlToPlainText,
} from '@/lib/security/rich-text';

export type RichTextEditorVariant = 'title' | 'summary' | 'content';

interface RichTextEditorProps {
  id?: string;
  value: string;
  onChange: (html: string) => void;
  variant?: RichTextEditorVariant;
  placeholder?: string;
  disabled?: boolean;
  ariaLabel?: string;
  minChars?: number;
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    blockSpacing: {
      setBlockLineHeight: (lineHeight: string) => ReturnType;
      unsetBlockLineHeight: () => ReturnType;
      setParagraphSpacing: (spacing: string) => ReturnType;
      unsetParagraphSpacing: () => ReturnType;
    };
  }
}

const SPACING_BLOCK_TYPES = ['paragraph', 'heading', 'blockquote'];

const BlockSpacing = Extension.create({
  name: 'blockSpacing',

  addGlobalAttributes() {
    return [
      {
        types: SPACING_BLOCK_TYPES,
        attributes: {
          lineHeight: {
            default: null,
            parseHTML: (element) => element.style.lineHeight || null,
            renderHTML: (attributes) => {
              if (!attributes.lineHeight) return {};
              return { style: `line-height: ${attributes.lineHeight}` };
            },
          },
          paragraphSpacing: {
            default: null,
            parseHTML: (element) => element.style.marginBottom || null,
            renderHTML: (attributes) => {
              if (!attributes.paragraphSpacing) return {};
              return { style: `margin-bottom: ${attributes.paragraphSpacing}` };
            },
          },
        },
      },
    ];
  },

  addCommands() {
    return {
      setBlockLineHeight:
        (lineHeight: string) =>
        ({ commands }) =>
          SPACING_BLOCK_TYPES.some((type) =>
            commands.updateAttributes(type, { lineHeight })
          ),
      unsetBlockLineHeight:
        () =>
        ({ commands }) =>
          SPACING_BLOCK_TYPES.some((type) =>
            commands.resetAttributes(type, 'lineHeight')
          ),
      setParagraphSpacing:
        (spacing: string) =>
        ({ commands }) =>
          SPACING_BLOCK_TYPES.some((type) =>
            commands.updateAttributes(type, { paragraphSpacing: spacing })
          ),
      unsetParagraphSpacing:
        () =>
        ({ commands }) =>
          SPACING_BLOCK_TYPES.some((type) =>
            commands.resetAttributes(type, 'paragraphSpacing')
          ),
    };
  },
});

const TEXT_COLOR_SWATCHES = [
  { label: 'Default (Slate)', value: '' },
  { label: 'Hitam Pekat', value: '#0f172a' },
  { label: 'Emerald', value: '#047857' },
  { label: 'Biru', value: '#0369a1' },
  { label: 'Merah', value: '#be123c' },
  { label: 'Amber', value: '#b45309' },
  { label: 'Ungu', value: '#6d28d9' },
];

const FONT_SIZE_OPTIONS = [
  { label: 'Default', value: '' },
  { label: '12px (Kecil)', value: '12px' },
  { label: '14px (Normal)', value: '14px' },
  { label: '16px (Sedang)', value: '16px' },
  { label: '18px (Agak Besar)', value: '18px' },
  { label: '20px (Besar)', value: '20px' },
  { label: '24px (Subjudul)', value: '24px' },
  { label: '28px (Judul)', value: '28px' },
];

const LINE_HEIGHT_OPTIONS = [
  { label: 'Default', value: '' },
  { label: '1.0 (Rapat)', value: '1' },
  { label: '1.15', value: '1.15' },
  { label: '1.5 (Standar)', value: '1.5' },
  { label: '1.75 (Longgar)', value: '1.75' },
  { label: '2.0 (Ganda)', value: '2' },
];

const PARAGRAPH_SPACING_OPTIONS = [
  { label: 'Default', value: '' },
  { label: '0px (Rapat)', value: '0px' },
  { label: '8px (Kecil)', value: '8px' },
  { label: '16px (Sedang)', value: '16px' },
  { label: '24px (Besar)', value: '24px' },
  { label: '32px (Sangat Besar)', value: '32px' },
];

function toEditorHtml(raw: string, variant: RichTextEditorVariant): string {
  const trimmed = (raw || '').trim();
  if (!trimmed) return '';
  const mode =
    variant === 'title'
      ? 'inline-single'
      : variant === 'summary'
      ? 'inline'
      : 'block';
  return prepareRichTextHtmlForRender(trimmed, mode);
}

function normalizeEmittedHtml(rawHtml: string, variant: RichTextEditorVariant): string {
  const mode =
    variant === 'title'
      ? 'inline-single'
      : variant === 'summary'
      ? 'inline'
      : 'block';
  return sanitizeRichTextHtml(rawHtml, mode);
}

function ToolbarButton({
  active = false,
  disabled = false,
  title,
  onClick,
  children,
}: {
  active?: boolean;
  disabled?: boolean;
  title: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      aria-pressed={active}
      disabled={disabled}
      onMouseDown={(e) => {
        e.preventDefault();
      }}
      onClick={onClick}
      className={`inline-flex items-center justify-center w-7 h-7 rounded-lg text-xs transition shrink-0 ${
        active
          ? 'bg-emerald-600 text-white shadow-xs'
          : 'text-slate-600 hover:bg-slate-200/80 hover:text-slate-900'
      }`}
    >
      {children}
    </button>
  );
}

function ToolbarDivider() {
  return <span aria-hidden="true" className="w-px h-4 bg-slate-200 mx-0.5 shrink-0" />;
}

export function RichTextEditor({
  id,
  value,
  onChange,
  variant = 'content',
  placeholder = 'Tulis di sini...',
  disabled = false,
  ariaLabel,
  minChars,
}: RichTextEditorProps) {
  const isTitle = variant === 'title';
  const isSummary = variant === 'summary';
  const isContent = variant === 'content';

  const lastEmittedRef = useRef<string>(value || '');
  const [openMenu, setOpenMenu] = useState<'color' | 'fontSize' | 'spacing' | null>(null);
  const [showLinkInput, setShowLinkInput] = useState(false);
  const [linkUrl, setLinkUrl] = useState('');
  const [linkError, setLinkError] = useState<string | null>(null);
  const toolbarRef = useRef<HTMLDivElement | null>(null);

  const extensions = useMemo<Extensions>(() => {
    const base: Extensions = [
      StarterKit.configure({
        heading: isContent ? { levels: [2, 3, 4] } : false,
        bulletList: isContent ? {} : false,
        orderedList: isContent ? {} : false,
        blockquote: isContent ? {} : false,
        codeBlock: isContent ? {} : false,
        horizontalRule: isContent ? {} : false,
        hardBreak: isTitle ? false : {},
        link: isTitle
          ? false
          : {
              openOnClick: false,
              autolink: true,
              HTMLAttributes: {
                rel: 'noopener noreferrer',
                target: '_blank',
              },
            },
      }),
      TextStyle,
      Color,
      Highlight.configure({ multicolor: false }),
      Placeholder.configure({ placeholder }),
    ];

    if (isSummary || isContent) {
      base.push(
        TextAlign.configure({
          types: ['heading', 'paragraph'],
        })
      );
    }

    if (isContent) {
      base.push(FontSize, BlockSpacing);
    }

    return base;
  }, [isContent, isSummary, isTitle, placeholder]);

  const editor = useEditor({
    extensions,
    content: toEditorHtml(value, variant),
    editable: !disabled,
    immediatelyRender: false,
    editorProps: {
      attributes: {
        ...(id ? { id } : {}),
        role: 'textbox',
        'aria-multiline': isTitle ? 'false' : 'true',
        ...(ariaLabel ? { 'aria-label': ariaLabel } : {}),
        class: isTitle
          ? 'px-3.5 py-2.5 text-sm font-semibold text-slate-900 min-h-[42px] leading-snug'
          : isContent
          ? 'px-3.5 py-3 text-sm text-slate-800 min-h-[220px] leading-relaxed'
          : 'px-3.5 py-2.5 text-sm text-slate-800 min-h-[76px] leading-relaxed',
      },
      handleKeyDown: (_view, event) => {
        if (isTitle && event.key === 'Enter') {
          event.preventDefault();
          return true;
        }
        return false;
      },
    },
    onUpdate: ({ editor: instance }) => {
      const normalized = normalizeEmittedHtml(instance.getHTML(), variant);
      if (normalized !== lastEmittedRef.current) {
        lastEmittedRef.current = normalized;
        onChange(normalized);
      }
    },
  });

  // Sync editable state
  useEffect(() => {
    if (editor) {
      editor.setEditable(!disabled);
    }
  }, [editor, disabled]);

  // Sync external value changes (e.g., when switching to Edit mode or resetting the form)
  useEffect(() => {
    if (!editor) return;
    const incoming = value || '';
    if (incoming === lastEmittedRef.current) return;

    const currentNormalized = normalizeEmittedHtml(editor.getHTML(), variant);
    const incomingNormalized = normalizeEmittedHtml(incoming, variant);
    lastEmittedRef.current = incoming;

    if (currentNormalized !== incomingNormalized) {
      editor.commands.setContent(toEditorHtml(incoming, variant), { emitUpdate: false });
    }
  }, [editor, value, variant]);

  // Close open dropdown popovers on outside click or Escape
  useEffect(() => {
    if (!openMenu) return;
    const handlePointerDown = (e: MouseEvent) => {
      if (toolbarRef.current && !toolbarRef.current.contains(e.target as Node)) {
        setOpenMenu(null);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpenMenu(null);
    };
    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [openMenu]);

  function openLinkPrompt() {
    if (!editor) return;
    const prevHref = (editor.getAttributes('link')?.href as string) || '';
    setLinkUrl(prevHref);
    setLinkError(null);
    setOpenMenu(null);
    setShowLinkInput(true);
  }

  function applyLink() {
    if (!editor) return;
    const trimmed = linkUrl.trim();
    if (!trimmed) {
      editor.chain().focus().extendMarkRange('link').unsetLink().run();
      setShowLinkInput(false);
      setLinkError(null);
      return;
    }

    const withProtocol = /^(https?:\/\/|mailto:)/i.test(trimmed)
      ? trimmed
      : `https://${trimmed}`;

    try {
      const parsed = new URL(withProtocol);
      if (!['http:', 'https:', 'mailto:'].includes(parsed.protocol)) {
        setLinkError('Gunakan tautan dengan protokol http://, https://, atau mailto:.');
        return;
      }
    } catch {
      setLinkError('Format URL tautan tidak valid.');
      return;
    }

    editor
      .chain()
      .focus()
      .extendMarkRange('link')
      .setLink({ href: withProtocol, target: '_blank', rel: 'noopener noreferrer' })
      .run();
    setShowLinkInput(false);
    setLinkError(null);
  }

  const plainCharCount = stripHtmlToPlainText(value).length;
  const activeColor = (editor?.getAttributes('textStyle')?.color as string) || '';
  const activeFontSize = (editor?.getAttributes('textStyle')?.fontSize as string) || '';
  const activeBlockAttrs =
    (editor?.isActive('heading')
      ? editor.getAttributes('heading')
      : editor?.isActive('blockquote')
      ? editor.getAttributes('blockquote')
      : editor?.getAttributes('paragraph')) || {};
  const activeLineHeight = (activeBlockAttrs.lineHeight as string) || '';
  const activeParagraphSpacing = (activeBlockAttrs.paragraphSpacing as string) || '';

  return (
    <div
      className={`tiptap-editor min-w-0 max-w-full rounded-xl border border-slate-300 bg-white transition focus-within:ring-2 focus-within:ring-emerald-500/30 focus-within:border-emerald-600 ${
        disabled ? 'opacity-60 pointer-events-none bg-slate-50' : ''
      }`}
    >
      {/* Toolbar wrapper (sticky below the h-16 portal navbar on Isi Konten) */}
      <div
        ref={toolbarRef}
        className={
          isContent
            ? 'sticky top-16 z-20 rounded-t-xl bg-slate-50/95 backdrop-blur-md shadow-[0_2px_8px_-4px_rgba(15,23,42,0.12)]'
            : 'rounded-t-xl bg-slate-50/90'
        }
      >
        <div
          role="toolbar"
          aria-label={`Toolbar format ${ariaLabel || variant}`}
          className="flex flex-wrap items-center gap-0.5 px-2 py-1.5 border-b border-slate-200/90"
        >
          {/* History */}
          <ToolbarButton
            title="Urungkan (Undo)"
            disabled={!editor?.can().undo()}
            onClick={() => editor?.chain().focus().undo().run()}
          >
            <Undo2 className="w-3.5 h-3.5" />
          </ToolbarButton>
          <ToolbarButton
            title="Ulangi (Redo)"
            disabled={!editor?.can().redo()}
            onClick={() => editor?.chain().focus().redo().run()}
          >
            <Redo2 className="w-3.5 h-3.5" />
          </ToolbarButton>

          <ToolbarDivider />

          {/* Headings & Font Size (Content only) */}
          {isContent && (
            <>
              <ToolbarButton
                title="Subjudul H2"
                active={Boolean(editor?.isActive('heading', { level: 2 }))}
                onClick={() => editor?.chain().focus().toggleHeading({ level: 2 }).run()}
              >
                <Heading2 className="w-3.5 h-3.5" />
              </ToolbarButton>
              <ToolbarButton
                title="Subjudul H3"
                active={Boolean(editor?.isActive('heading', { level: 3 }))}
                onClick={() => editor?.chain().focus().toggleHeading({ level: 3 }).run()}
              >
                <Heading3 className="w-3.5 h-3.5" />
              </ToolbarButton>

              {/* Font Size Dropdown */}
              <div className="relative">
                <button
                  type="button"
                  title="Ukuran Font"
                  aria-label="Ukuran Font"
                  aria-expanded={openMenu === 'fontSize'}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() =>
                    setOpenMenu((prev) => (prev === 'fontSize' ? null : 'fontSize'))
                  }
                  className={`inline-flex items-center gap-1 h-7 px-2 rounded-lg text-[11px] font-semibold transition shrink-0 ${
                    openMenu === 'fontSize' || activeFontSize
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'text-slate-600 hover:bg-slate-200/80 hover:text-slate-900'
                  }`}
                >
                  <ALargeSmall className="w-3.5 h-3.5 shrink-0" />
                  <span className="tabular-nums">{activeFontSize || 'Size'}</span>
                  <ChevronDown className="w-3 h-3 shrink-0 opacity-80" />
                </button>

                {openMenu === 'fontSize' && (
                  <div className="absolute left-0 top-full mt-1 z-30 w-40 max-w-[calc(100vw-2.5rem)] p-1.5 rounded-xl bg-white border border-slate-200 shadow-lg space-y-0.5">
                    <p className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      Ukuran Font
                    </p>
                    {FONT_SIZE_OPTIONS.map((opt) => {
                      const isSelected = activeFontSize.toLowerCase() === opt.value.toLowerCase();
                      return (
                        <button
                          key={opt.label}
                          type="button"
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => {
                            if (!opt.value) {
                              editor?.chain().focus().unsetFontSize().run();
                            } else {
                              editor?.chain().focus().setFontSize(opt.value).run();
                            }
                            setOpenMenu(null);
                          }}
                          className={`w-full flex items-center justify-between px-2 py-1.5 rounded-lg text-xs text-left transition ${
                            isSelected
                              ? 'bg-emerald-50 text-emerald-800 font-semibold'
                              : 'text-slate-700 hover:bg-slate-100'
                          }`}
                        >
                          <span>{opt.label}</span>
                          {isSelected && <Check className="w-3.5 h-3.5 text-emerald-600" />}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Line Height & Paragraph Spacing Dropdown */}
              <div className="relative">
                <button
                  type="button"
                  title="Spasi Baris & Paragraf"
                  aria-label="Spasi Baris dan Paragraf"
                  aria-expanded={openMenu === 'spacing'}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() =>
                    setOpenMenu((prev) => (prev === 'spacing' ? null : 'spacing'))
                  }
                  className={`inline-flex items-center gap-1 h-7 px-2 rounded-lg text-[11px] font-semibold transition shrink-0 ${
                    openMenu === 'spacing' || activeLineHeight || activeParagraphSpacing
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'text-slate-600 hover:bg-slate-200/80 hover:text-slate-900'
                  }`}
                >
                  <ArrowUpDown className="w-3.5 h-3.5 shrink-0" />
                  <span className="hidden sm:inline">Spasi</span>
                  <ChevronDown className="w-3 h-3 shrink-0 opacity-80" />
                </button>

                {openMenu === 'spacing' && (
                  <div className="absolute right-0 sm:left-0 sm:right-auto top-full mt-1 z-30 w-56 max-w-[calc(100vw-2.5rem)] p-2 rounded-xl bg-white border border-slate-200 shadow-lg space-y-2.5">
                    <div className="space-y-0.5">
                      <p className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                        Spasi Baris (Line Height)
                      </p>
                      <div className="grid grid-cols-2 gap-1">
                        {LINE_HEIGHT_OPTIONS.map((opt) => {
                          const isSelected = activeLineHeight === opt.value;
                          return (
                            <button
                              key={opt.label}
                              type="button"
                              onMouseDown={(e) => e.preventDefault()}
                              onClick={() => {
                                if (!opt.value) {
                                  editor?.chain().focus().unsetBlockLineHeight().run();
                                } else {
                                  editor?.chain().focus().setBlockLineHeight(opt.value).run();
                                }
                              }}
                              className={`px-2 py-1 rounded-lg text-[11px] text-left transition ${
                                isSelected
                                  ? 'bg-emerald-600 text-white font-semibold'
                                  : 'bg-slate-50 text-slate-700 hover:bg-slate-100'
                              }`}
                            >
                              {opt.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div className="border-t border-slate-100 pt-2 space-y-0.5">
                      <p className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                        Spasi Paragraf (Jarak Bawah)
                      </p>
                      <div className="grid grid-cols-2 gap-1">
                        {PARAGRAPH_SPACING_OPTIONS.map((opt) => {
                          const isSelected =
                            activeParagraphSpacing.toLowerCase() === opt.value.toLowerCase();
                          return (
                            <button
                              key={opt.label}
                              type="button"
                              onMouseDown={(e) => e.preventDefault()}
                              onClick={() => {
                                if (!opt.value) {
                                  editor?.chain().focus().unsetParagraphSpacing().run();
                                } else {
                                  editor?.chain().focus().setParagraphSpacing(opt.value).run();
                                }
                              }}
                              className={`px-2 py-1 rounded-lg text-[11px] text-left transition ${
                                isSelected
                                  ? 'bg-emerald-600 text-white font-semibold'
                                  : 'bg-slate-50 text-slate-700 hover:bg-slate-100'
                              }`}
                            >
                              {opt.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <ToolbarDivider />
            </>
          )}

          {/* Inline Marks */}
          <ToolbarButton
            title="Tebal (Ctrl+B)"
            active={Boolean(editor?.isActive('bold'))}
            onClick={() => editor?.chain().focus().toggleBold().run()}
          >
            <Bold className="w-3.5 h-3.5" />
          </ToolbarButton>
          <ToolbarButton
            title="Miring (Ctrl+I)"
            active={Boolean(editor?.isActive('italic'))}
            onClick={() => editor?.chain().focus().toggleItalic().run()}
          >
            <Italic className="w-3.5 h-3.5" />
          </ToolbarButton>
          <ToolbarButton
            title="Garis Bawah (Ctrl+U)"
            active={Boolean(editor?.isActive('underline'))}
            onClick={() => editor?.chain().focus().toggleUnderline().run()}
          >
            <UnderlineIcon className="w-3.5 h-3.5" />
          </ToolbarButton>
          <ToolbarButton
            title="Coret (Strikethrough)"
            active={Boolean(editor?.isActive('strike'))}
            onClick={() => editor?.chain().focus().toggleStrike().run()}
          >
            <Strikethrough className="w-3.5 h-3.5" />
          </ToolbarButton>
          <ToolbarButton
            title="Sorot Teks (Highlight)"
            active={Boolean(editor?.isActive('highlight'))}
            onClick={() => editor?.chain().focus().toggleHighlight().run()}
          >
            <Highlighter className="w-3.5 h-3.5" />
          </ToolbarButton>

          {/* Text Color Picker */}
          <div className="relative">
            <ToolbarButton
              title="Warna Teks"
              active={openMenu === 'color' || Boolean(activeColor)}
              onClick={() => setOpenMenu((prev) => (prev === 'color' ? null : 'color'))}
            >
              <span className="relative flex items-center justify-center">
                <Palette className="w-3.5 h-3.5" />
                {activeColor && (
                  <span
                    aria-hidden="true"
                    className="absolute -bottom-0.5 inset-x-0.5 h-0.5 rounded-full"
                    style={{ backgroundColor: activeColor }}
                  />
                )}
              </span>
            </ToolbarButton>

            {openMenu === 'color' && (
              <div className="absolute right-0 sm:left-0 sm:right-auto top-full mt-1 z-30 flex flex-wrap items-center gap-1.5 p-2 rounded-xl bg-white border border-slate-200 shadow-lg max-w-[calc(100vw-2.5rem)]">
                {TEXT_COLOR_SWATCHES.map((swatch) => {
                  const isSelected = activeColor.toLowerCase() === swatch.value.toLowerCase();
                  return (
                    <button
                      key={swatch.label}
                      type="button"
                      title={swatch.label}
                      aria-label={swatch.label}
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => {
                        if (!swatch.value) {
                          editor?.chain().focus().unsetColor().run();
                        } else {
                          editor?.chain().focus().setColor(swatch.value).run();
                        }
                        setOpenMenu(null);
                      }}
                      className={`w-5 h-5 rounded-full border flex items-center justify-center transition ${
                        isSelected
                          ? 'ring-2 ring-emerald-500 ring-offset-1 border-slate-400'
                          : 'border-slate-300 hover:scale-110'
                      }`}
                      style={{ backgroundColor: swatch.value || '#ffffff' }}
                    >
                      {!swatch.value && <X className="w-3 h-3 text-slate-500" />}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Link (Summary & Content) */}
          {!isTitle && (
            <>
              <ToolbarDivider />
              <ToolbarButton
                title="Sisipkan / Ubah Tautan"
                active={Boolean(editor?.isActive('link')) || showLinkInput}
                onClick={openLinkPrompt}
              >
                <Link2 className="w-3.5 h-3.5" />
              </ToolbarButton>
              {editor?.isActive('link') && (
                <ToolbarButton
                  title="Hapus Tautan"
                  onClick={() => {
                    editor.chain().focus().extendMarkRange('link').unsetLink().run();
                    setShowLinkInput(false);
                  }}
                >
                  <Unlink className="w-3.5 h-3.5" />
                </ToolbarButton>
              )}
            </>
          )}

          {/* Alignment (Summary & Content) */}
          {(isSummary || isContent) && (
            <>
              <ToolbarDivider />
              <ToolbarButton
                title="Rata Kiri"
                active={Boolean(editor?.isActive({ textAlign: 'left' }))}
                onClick={() => editor?.chain().focus().setTextAlign('left').run()}
              >
                <AlignLeft className="w-3.5 h-3.5" />
              </ToolbarButton>
              <ToolbarButton
                title="Rata Tengah"
                active={Boolean(editor?.isActive({ textAlign: 'center' }))}
                onClick={() => editor?.chain().focus().setTextAlign('center').run()}
              >
                <AlignCenter className="w-3.5 h-3.5" />
              </ToolbarButton>
              <ToolbarButton
                title="Rata Kanan"
                active={Boolean(editor?.isActive({ textAlign: 'right' }))}
                onClick={() => editor?.chain().focus().setTextAlign('right').run()}
              >
                <AlignRight className="w-3.5 h-3.5" />
              </ToolbarButton>
              <ToolbarButton
                title="Rata Kanan-Kiri (Justify)"
                active={Boolean(editor?.isActive({ textAlign: 'justify' }))}
                onClick={() => editor?.chain().focus().setTextAlign('justify').run()}
              >
                <AlignJustify className="w-3.5 h-3.5" />
              </ToolbarButton>
            </>
          )}

          {/* Lists & Blocks (Content only) */}
          {isContent && (
            <>
              <ToolbarDivider />
              <ToolbarButton
                title="Daftar Poin (Bullet List)"
                active={Boolean(editor?.isActive('bulletList'))}
                onClick={() => editor?.chain().focus().toggleBulletList().run()}
              >
                <List className="w-3.5 h-3.5" />
              </ToolbarButton>
              <ToolbarButton
                title="Daftar Bernomor (Ordered List)"
                active={Boolean(editor?.isActive('orderedList'))}
                onClick={() => editor?.chain().focus().toggleOrderedList().run()}
              >
                <ListOrdered className="w-3.5 h-3.5" />
              </ToolbarButton>
              <ToolbarButton
                title="Kutipan (Blockquote)"
                active={Boolean(editor?.isActive('blockquote'))}
                onClick={() => editor?.chain().focus().toggleBlockquote().run()}
              >
                <Quote className="w-3.5 h-3.5" />
              </ToolbarButton>
              <ToolbarButton
                title="Kode Inline"
                active={Boolean(editor?.isActive('code'))}
                onClick={() => editor?.chain().focus().toggleCode().run()}
              >
                <Code className="w-3.5 h-3.5" />
              </ToolbarButton>
              <ToolbarButton
                title="Garis Pemisah"
                onClick={() => editor?.chain().focus().setHorizontalRule().run()}
              >
                <Minus className="w-3.5 h-3.5" />
              </ToolbarButton>
            </>
          )}

          <ToolbarDivider />

          <ToolbarButton
            title="Hapus Semua Format"
            onClick={() => {
              if (!editor) return;
              const chain = editor.chain().focus().unsetAllMarks();
              if (isSummary || isContent) {
                chain.unsetTextAlign();
              }
              if (isContent) {
                chain.clearNodes().unsetFontSize().unsetBlockLineHeight().unsetParagraphSpacing();
              }
              chain.run();
            }}
          >
            <RemoveFormatting className="w-3.5 h-3.5" />
          </ToolbarButton>
        </div>

        {/* Inline Link URL Bar */}
        {showLinkInput && !isTitle && (
          <div className="px-2.5 py-2 border-b border-slate-200 bg-emerald-50/70 space-y-1">
            <div className="flex items-center gap-1.5">
              <input
                type="url"
                value={linkUrl}
                onChange={(e) => {
                  setLinkUrl(e.target.value);
                  if (linkError) setLinkError(null);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    applyLink();
                  } else if (e.key === 'Escape') {
                    e.preventDefault();
                    setShowLinkInput(false);
                  }
                }}
                placeholder="https://contoh.sch.id/informasi"
                className="flex-1 min-w-0 rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-600"
                autoFocus
              />
              <button
                type="button"
                onClick={applyLink}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shrink-0"
              >
                <Check className="w-3.5 h-3.5" />
                <span>Terapkan</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowLinkInput(false);
                  setLinkError(null);
                }}
                aria-label="Tutup input tautan"
                className="p-1 rounded-lg text-slate-500 hover:bg-slate-200/80 shrink-0"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
            {linkError && <p className="text-[11px] text-rose-600 font-medium">{linkError}</p>}
          </div>
        )}
      </div>

      {/* Editor Surface */}
      <EditorContent editor={editor} />

      {/* Subtle footer with plain-text character count when minChars is provided */}
      {typeof minChars === 'number' && (
        <div className="flex items-center justify-between px-3 py-1 border-t border-slate-100 bg-slate-50/50 rounded-b-xl text-[11px] text-slate-400">
          <span>
            {plainCharCount < minChars
              ? `Minimal ${minChars} karakter teks`
              : 'Format Rich Text aktif'}
          </span>
          <span
            className={`tabular-nums font-medium ${
              plainCharCount > 0 && plainCharCount < minChars ? 'text-amber-600' : 'text-slate-500'
            }`}
          >
            {plainCharCount.toLocaleString('id-ID')} karakter
          </span>
        </div>
      )}
    </div>
  );
}
