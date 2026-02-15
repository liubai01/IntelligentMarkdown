/**
 * CodeMirror 6 bundle for webview code editing
 * This file is bundled separately and loaded in the VS Code webview.
 */

import { EditorView, keymap, lineNumbers, highlightActiveLineGutter, highlightSpecialChars, drawSelection, highlightActiveLine, rectangularSelection, crosshairCursor } from '@codemirror/view';
import { EditorState, Compartment } from '@codemirror/state';
import { defaultHighlightStyle, syntaxHighlighting, indentOnInput, bracketMatching, foldGutter, foldKeymap, HighlightStyle, StreamLanguage } from '@codemirror/language';
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands';
import { closeBrackets, closeBracketsKeymap } from '@codemirror/autocomplete';
import { highlightSelectionMatches, searchKeymap } from '@codemirror/search';
import { oneDark, oneDarkHighlightStyle } from '@codemirror/theme-one-dark';

// Language imports - native CM6 packages
import { javascript } from '@codemirror/lang-javascript';
import { json } from '@codemirror/lang-json';
import { python } from '@codemirror/lang-python';
import { cpp } from '@codemirror/lang-cpp';
import { java } from '@codemirror/lang-java';
import { html } from '@codemirror/lang-html';
import { css } from '@codemirror/lang-css';
import { xml } from '@codemirror/lang-xml';
import { sql } from '@codemirror/lang-sql';
import { markdown } from '@codemirror/lang-markdown';
import { rust } from '@codemirror/lang-rust';
import { go } from '@codemirror/lang-go';

// Legacy modes for languages without native CM6 support
import { lua } from '@codemirror/legacy-modes/mode/lua';
import { ruby } from '@codemirror/legacy-modes/mode/ruby';
import { shell } from '@codemirror/legacy-modes/mode/shell';
import { yaml } from '@codemirror/legacy-modes/mode/yaml';
import { toml } from '@codemirror/legacy-modes/mode/toml';

// ============ Types ============

interface EditorInstance {
  view: EditorView;
  blockId: string;
  languageCompartment: Compartment;
  themeCompartment: Compartment;
  onChangeCallback?: (code: string) => void;
  onSaveCallback?: () => void;
}

// ============ Theme Configuration ============

/** VS Code adaptive theme using CSS variables */
const vsCodeLightTheme = EditorView.theme({
  '&': {
    backgroundColor: 'var(--vscode-textCodeBlock-background, var(--vscode-editor-background))',
    color: 'var(--vscode-editor-foreground)',
    fontSize: '12px',
    borderRadius: '0',
  },
  '.cm-content': {
    caretColor: 'var(--vscode-editorCursor-foreground, #000)',
    fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace',
    padding: '4px 0',
  },
  '.cm-cursor, .cm-dropCursor': {
    borderLeftColor: 'var(--vscode-editorCursor-foreground, #000)',
  },
  '&.cm-focused .cm-selectionBackground, .cm-selectionBackground, .cm-content ::selection': {
    backgroundColor: 'var(--vscode-editor-selectionBackground, rgba(173,214,255,0.3))',
  },
  '.cm-activeLine': {
    backgroundColor: 'var(--vscode-editor-lineHighlightBackground, rgba(0,0,0,0.04))',
  },
  '.cm-gutters': {
    backgroundColor: 'var(--vscode-editorGutter-background, var(--vscode-textCodeBlock-background, var(--vscode-editor-background)))',
    color: 'var(--vscode-editorLineNumber-foreground, #999)',
    border: 'none',
    borderRight: '1px solid var(--vscode-editorWidget-border, rgba(128,128,128,0.15))',
  },
  '.cm-activeLineGutter': {
    backgroundColor: 'var(--vscode-editor-lineHighlightBackground, rgba(0,0,0,0.04))',
    color: 'var(--vscode-editorLineNumber-activeForeground, #333)',
  },
  '.cm-foldPlaceholder': {
    backgroundColor: 'transparent',
    border: 'none',
    color: 'var(--vscode-editorCodeLens-foreground, #999)',
  },
  '.cm-matchingBracket': {
    backgroundColor: 'var(--vscode-editorBracketMatch-background, rgba(0,100,0,0.1))',
    outline: '1px solid var(--vscode-editorBracketMatch-border, rgba(0,100,0,0.3))',
  },
  '.cm-searchMatch': {
    backgroundColor: 'var(--vscode-editor-findMatchHighlightBackground, rgba(234,92,0,0.33))',
  },
  '.cm-searchMatch.cm-searchMatch-selected': {
    backgroundColor: 'var(--vscode-editor-findMatchBackground, rgba(162,190,80,0.5))',
  },
  '.cm-tooltip': {
    backgroundColor: 'var(--vscode-editorWidget-background)',
    border: '1px solid var(--vscode-editorWidget-border, rgba(128,128,128,0.2))',
    color: 'var(--vscode-editorWidget-foreground)',
  },
}, { dark: false });

const vsCodeDarkTheme = EditorView.theme({
  '&': {
    backgroundColor: 'var(--vscode-textCodeBlock-background, var(--vscode-editor-background))',
    color: 'var(--vscode-editor-foreground)',
    fontSize: '12px',
    borderRadius: '0',
  },
  '.cm-content': {
    caretColor: 'var(--vscode-editorCursor-foreground, #fff)',
    fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace',
    padding: '4px 0',
  },
  '.cm-cursor, .cm-dropCursor': {
    borderLeftColor: 'var(--vscode-editorCursor-foreground, #fff)',
  },
  '&.cm-focused .cm-selectionBackground, .cm-selectionBackground, .cm-content ::selection': {
    backgroundColor: 'var(--vscode-editor-selectionBackground, rgba(62,96,140,0.5))',
  },
  '.cm-activeLine': {
    backgroundColor: 'var(--vscode-editor-lineHighlightBackground, rgba(255,255,255,0.04))',
  },
  '.cm-gutters': {
    backgroundColor: 'var(--vscode-editorGutter-background, var(--vscode-textCodeBlock-background, var(--vscode-editor-background)))',
    color: 'var(--vscode-editorLineNumber-foreground, #858585)',
    border: 'none',
    borderRight: '1px solid var(--vscode-editorWidget-border, rgba(128,128,128,0.15))',
  },
  '.cm-activeLineGutter': {
    backgroundColor: 'var(--vscode-editor-lineHighlightBackground, rgba(255,255,255,0.04))',
    color: 'var(--vscode-editorLineNumber-activeForeground, #c6c6c6)',
  },
  '.cm-foldPlaceholder': {
    backgroundColor: 'transparent',
    border: 'none',
    color: 'var(--vscode-editorCodeLens-foreground, #999)',
  },
  '.cm-matchingBracket': {
    backgroundColor: 'var(--vscode-editorBracketMatch-background, rgba(0,100,0,0.2))',
    outline: '1px solid var(--vscode-editorBracketMatch-border, rgba(0,100,0,0.4))',
  },
  '.cm-searchMatch': {
    backgroundColor: 'var(--vscode-editor-findMatchHighlightBackground, rgba(234,92,0,0.33))',
  },
  '.cm-searchMatch.cm-searchMatch-selected': {
    backgroundColor: 'var(--vscode-editor-findMatchBackground, rgba(81,92,106,0.6))',
  },
  '.cm-tooltip': {
    backgroundColor: 'var(--vscode-editorWidget-background)',
    border: '1px solid var(--vscode-editorWidget-border, rgba(128,128,128,0.2))',
    color: 'var(--vscode-editorWidget-foreground)',
  },
}, { dark: true });

/** Light syntax highlighting (VS Code Light+ inspired) */
import { tags } from '@lezer/highlight';

const lightHighlightStyle = HighlightStyle.define([
  { tag: tags.keyword, color: '#0000ff' },
  { tag: tags.controlKeyword, color: '#0000ff' },
  { tag: tags.operatorKeyword, color: '#0000ff' },
  { tag: tags.definitionKeyword, color: '#0000ff' },
  { tag: tags.moduleKeyword, color: '#0000ff' },
  { tag: tags.literal, color: '#0000ff' },
  { tag: tags.bool, color: '#0000ff' },
  { tag: tags.null, color: '#0000ff' },
  { tag: tags.string, color: '#a31515' },
  { tag: tags.special(tags.string), color: '#a31515' },
  { tag: tags.regexp, color: '#811f3f' },
  { tag: tags.comment, color: '#008000', fontStyle: 'italic' },
  { tag: tags.lineComment, color: '#008000', fontStyle: 'italic' },
  { tag: tags.blockComment, color: '#008000', fontStyle: 'italic' },
  { tag: tags.docComment, color: '#008000', fontStyle: 'italic' },
  { tag: tags.number, color: '#098658' },
  { tag: tags.integer, color: '#098658' },
  { tag: tags.float, color: '#098658' },
  { tag: [tags.function(tags.variableName), tags.function(tags.definition(tags.variableName))], color: '#795e26' },
  { tag: tags.definition(tags.variableName), color: '#001080' },
  { tag: tags.variableName, color: '#001080' },
  { tag: tags.typeName, color: '#267f99' },
  { tag: tags.className, color: '#267f99' },
  { tag: tags.namespace, color: '#267f99' },
  { tag: tags.macroName, color: '#795e26' },
  { tag: tags.propertyName, color: '#001080' },
  { tag: tags.operator, color: '#000000' },
  { tag: tags.punctuation, color: '#000000' },
  { tag: tags.paren, color: '#000000' },
  { tag: tags.squareBracket, color: '#000000' },
  { tag: tags.brace, color: '#000000' },
  { tag: tags.meta, color: '#0000ff' },
  { tag: tags.tagName, color: '#800000' },
  { tag: tags.attributeName, color: '#e50000' },
  { tag: tags.attributeValue, color: '#a31515' },
  { tag: tags.self, color: '#0000ff' },
]);

/** Dark syntax highlighting (VS Code Dark+ inspired) */
const darkHighlightStyle = HighlightStyle.define([
  { tag: tags.keyword, color: '#569cd6' },
  { tag: tags.controlKeyword, color: '#c586c0' },
  { tag: tags.operatorKeyword, color: '#569cd6' },
  { tag: tags.definitionKeyword, color: '#569cd6' },
  { tag: tags.moduleKeyword, color: '#c586c0' },
  { tag: tags.literal, color: '#569cd6' },
  { tag: tags.bool, color: '#569cd6' },
  { tag: tags.null, color: '#569cd6' },
  { tag: tags.string, color: '#ce9178' },
  { tag: tags.special(tags.string), color: '#d7ba7d' },
  { tag: tags.regexp, color: '#d16969' },
  { tag: tags.comment, color: '#6a9955', fontStyle: 'italic' },
  { tag: tags.lineComment, color: '#6a9955', fontStyle: 'italic' },
  { tag: tags.blockComment, color: '#6a9955', fontStyle: 'italic' },
  { tag: tags.docComment, color: '#6a9955', fontStyle: 'italic' },
  { tag: tags.number, color: '#b5cea8' },
  { tag: tags.integer, color: '#b5cea8' },
  { tag: tags.float, color: '#b5cea8' },
  { tag: [tags.function(tags.variableName), tags.function(tags.definition(tags.variableName))], color: '#dcdcaa' },
  { tag: tags.definition(tags.variableName), color: '#9cdcfe' },
  { tag: tags.variableName, color: '#9cdcfe' },
  { tag: tags.typeName, color: '#4ec9b0' },
  { tag: tags.className, color: '#4ec9b0' },
  { tag: tags.namespace, color: '#4ec9b0' },
  { tag: tags.macroName, color: '#dcdcaa' },
  { tag: tags.propertyName, color: '#9cdcfe' },
  { tag: tags.operator, color: '#d4d4d4' },
  { tag: tags.punctuation, color: '#d4d4d4' },
  { tag: tags.paren, color: '#d4d4d4' },
  { tag: tags.squareBracket, color: '#d4d4d4' },
  { tag: tags.brace, color: '#d4d4d4' },
  { tag: tags.meta, color: '#569cd6' },
  { tag: tags.tagName, color: '#569cd6' },
  { tag: tags.attributeName, color: '#9cdcfe' },
  { tag: tags.attributeValue, color: '#ce9178' },
  { tag: tags.self, color: '#569cd6' },
]);

// ============ Language Support ============

function getLanguageExtension(lang: string) {
  switch (lang) {
    case 'lua': return StreamLanguage.define(lua);
    case 'javascript': return javascript();
    case 'typescript': return javascript({ typescript: true });
    case 'jsx': return javascript({ jsx: true });
    case 'tsx': return javascript({ jsx: true, typescript: true });
    case 'json': return json();
    case 'python': return python();
    case 'c':
    case 'cpp': return cpp();
    case 'java': return java();
    case 'html': return html();
    case 'css': return css();
    case 'xml': return xml();
    case 'sql': return sql();
    case 'markdown': return markdown();
    case 'rust': return rust();
    case 'go': return go();
    case 'ruby': return StreamLanguage.define(ruby);
    case 'bash':
    case 'shell': return StreamLanguage.define(shell);
    case 'yaml': return StreamLanguage.define(yaml);
    case 'toml':
    case 'ini': return StreamLanguage.define(toml);
    default: return [];
  }
}

// ============ Editor Manager ============

const editors = new Map<string, EditorInstance>();

function isDarkTheme(): boolean {
  return document.body.classList.contains('vscode-dark') ||
    document.body.classList.contains('vscode-high-contrast');
}

function getThemeExtensions(dark: boolean) {
  if (dark) {
    return [vsCodeDarkTheme, syntaxHighlighting(darkHighlightStyle)];
  } else {
    return [vsCodeLightTheme, syntaxHighlighting(lightHighlightStyle)];
  }
}

/**
 * Create a CodeMirror editor instance
 */
function createEditor(
  blockId: string,
  container: HTMLElement,
  code: string,
  lang: string,
  onChange?: (code: string) => void,
  onSave?: () => void
): EditorView {
  // Destroy existing instance
  destroyEditor(blockId);

  const dark = isDarkTheme();
  const languageCompartment = new Compartment();
  const themeCompartment = new Compartment();

  const langExt = getLanguageExtension(lang);

  const updateListener = EditorView.updateListener.of((update) => {
    if (update.docChanged && onChange) {
      onChange(update.state.doc.toString());
    }
  });

  // Build keymaps — add Ctrl+S / Cmd+S save binding if onSave is provided
  const keymaps = [
    ...closeBracketsKeymap,
    ...defaultKeymap,
    ...searchKeymap,
    ...historyKeymap,
    ...foldKeymap,
    indentWithTab,
  ];

  if (onSave) {
    // Prepend save keymap so it takes priority
    keymaps.unshift({
      key: 'Mod-s',
      run: () => {
        onSave();
        return true;  // Prevent default browser/webview behavior
      },
    });
  }

  const state = EditorState.create({
    doc: code,
    extensions: [
      // Basic editing features
      lineNumbers(),
      highlightActiveLineGutter(),
      highlightSpecialChars(),
      history(),
      foldGutter(),
      drawSelection(),
      EditorState.allowMultipleSelections.of(true),
      indentOnInput(),
      bracketMatching(),
      closeBrackets(),
      rectangularSelection(),
      crosshairCursor(),
      highlightActiveLine(),
      highlightSelectionMatches(),
      // Keymaps
      keymap.of(keymaps),
      // Language support (in compartment for dynamic switching)
      languageCompartment.of(langExt),
      // Theme (in compartment)
      themeCompartment.of(getThemeExtensions(dark)),
      // Change listener
      updateListener,
      // Editor config
      EditorView.lineWrapping,
      EditorState.tabSize.of(4),
    ],
  });

  const view = new EditorView({
    state,
    parent: container,
  });

  editors.set(blockId, {
    view,
    blockId,
    languageCompartment,
    themeCompartment,
    onChangeCallback: onChange,
    onSaveCallback: onSave,
  });

  return view;
}

/**
 * Get editor content
 */
function getValue(blockId: string): string {
  const instance = editors.get(blockId);
  if (!instance) return '';
  return instance.view.state.doc.toString();
}

/**
 * Set editor content
 */
function setValue(blockId: string, code: string): void {
  const instance = editors.get(blockId);
  if (!instance) return;
  instance.view.dispatch({
    changes: {
      from: 0,
      to: instance.view.state.doc.length,
      insert: code,
    },
  });
}

/**
 * Destroy editor instance
 */
function destroyEditor(blockId: string): void {
  const instance = editors.get(blockId);
  if (instance) {
    instance.view.destroy();
    editors.delete(blockId);
  }
}

/**
 * Destroy all editor instances
 */
function destroyAll(): void {
  for (const [blockId] of editors) {
    destroyEditor(blockId);
  }
}

/**
 * Focus editor
 */
function focusEditor(blockId: string): void {
  const instance = editors.get(blockId);
  if (instance) {
    instance.view.focus();
  }
}

// ============ Expose globally ============

(window as any).CodeEditor = {
  create: createEditor,
  getValue,
  setValue,
  destroy: destroyEditor,
  destroyAll,
  focus: focusEditor,
};
