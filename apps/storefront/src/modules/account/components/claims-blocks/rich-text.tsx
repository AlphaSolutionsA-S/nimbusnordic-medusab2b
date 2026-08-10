import type { ClaimsRichTextBlock } from '@/types/cms';

// Simple safe serializer for Lexical JSON content
// Only renders: paragraphs, headings, emphasis, lists, validated links
// Rejects: raw HTML, scripts, iframes, arbitrary elements
function serializeLexicalNode(node: unknown): React.ReactNode {
  if (!node || typeof node !== 'object') return null;

  const obj = node as Record<string, unknown>;
  const type = obj.type;

  switch (type) {
    case 'root':
    case 'paragraph':
      return (
        <p className="text-ui-fg-base mb-3">
          {Array.isArray(obj.children)
            ? obj.children.map((child, i) => <div key={i}>{serializeLexicalNode(child)}</div>)
            : null}
        </p>
      );

    case 'heading':
      const level = obj.tag || 'h2';
      const HeadingTag = level as keyof JSX.IntrinsicElements;
      const headingClasses = {
        h1: 'text-xl font-bold mb-4',
        h2: 'text-lg font-bold mb-3',
        h3: 'text-base font-bold mb-2',
      }[level] || 'font-bold mb-2';

      return (
        <HeadingTag className={`text-ui-fg-base ${headingClasses}`}>
          {Array.isArray(obj.children)
            ? obj.children.map((child, i) => <div key={i}>{serializeLexicalNode(child)}</div>)
            : null}
        </HeadingTag>
      );

    case 'list':
      const listTag = obj.tag === 'ol' ? 'ol' : 'ul';
      const ListTag = listTag as keyof JSX.IntrinsicElements;
      const listClasses = listTag === 'ol' ? 'list-decimal' : 'list-disc';

      return (
        <ListTag className={`${listClasses} pl-6 mb-3 text-ui-fg-base`}>
          {Array.isArray(obj.children)
            ? obj.children.map((child, i) => <div key={i}>{serializeLexicalNode(child)}</div>)
            : null}
        </ListTag>
      );

    case 'listitem':
      return (
        <li className="mb-1">
          {Array.isArray(obj.children)
            ? obj.children.map((child, i) => <div key={i}>{serializeLexicalNode(child)}</div>)
            : null}
        </li>
      );

    case 'text':
      const text = String(obj.text || '');
      const bold = obj.bold === true;
      const italic = obj.italic === true;

      let className = 'text-ui-fg-base';
      if (bold) className += ' font-semibold';
      if (italic) className += ' italic';

      const element = <span className={className}>{text}</span>;

      if (bold || italic) {
        return element;
      }
      return text;

    case 'link':
      const href = String(obj.url || '');
      // Only render safe links (http/https, or internal /)
      if (!href.startsWith('http://') && !href.startsWith('https://') && !href.startsWith('/')) {
        return Array.isArray(obj.children)
          ? obj.children.map((child, i) => <div key={i}>{serializeLexicalNode(child)}</div>)
          : null;
      }

      return (
        <a href={href} className="text-ui-interactive-base underline hover:text-ui-interactive-hover">
          {Array.isArray(obj.children)
            ? obj.children.map((child, i) => <div key={i}>{serializeLexicalNode(child)}</div>)
            : null}
        </a>
      );

    default:
      return null;
  }
}

export function ClaimsRichText({ block }: { block: ClaimsRichTextBlock }) {
  if (!block.content || typeof block.content !== 'object') {
    return null;
  }

  return (
    <div data-testid="claims-rich-text-block" className="prose prose-sm max-w-none">
      {serializeLexicalNode(block.content)}
    </div>
  );
}
