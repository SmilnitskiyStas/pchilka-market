import { Fragment, type ReactNode } from 'react';
import { isSafePageUrl } from '@/lib/visual-pages';

// Small, text-only formatting vocabulary. No HTML or embedded media is executed.
function inline(text: string): ReactNode[] {
  return text.split(/(\*\*[^*]+\*\*|_[^_]+_|\[[^\]]+\]\([^)]+\))/g).map((part, index) => {
    if (part.startsWith('**') && part.endsWith('**')) return <strong key={index}>{part.slice(2, -2)}</strong>;
    if (part.startsWith('_') && part.endsWith('_')) return <em key={index}>{part.slice(1, -1)}</em>;
    const match = part.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
    if (match && isSafePageUrl(match[2])) return <a key={index} href={match[2]} className="font-semibold text-brand underline">{match[1]}</a>;
    return <Fragment key={index}>{part}</Fragment>;
  });
}
export default function VisualRichText({ text }: { text: string }) {
  const lines = text.split('\n');
  const nodes: ReactNode[] = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (/^[-*] /.test(line)) {
      const items: ReactNode[] = [];
      do { items.push(<li key={i}>{inline(lines[i].slice(2))}</li>); i++; } while (i < lines.length && /^[-*] /.test(lines[i]));
      i--; nodes.push(<ul key={`list-${i}`} className="list-inside list-disc space-y-1">{items}</ul>);
    } else nodes.push(line ? <p key={i} className="whitespace-pre-wrap">{inline(line)}</p> : <div key={i} aria-hidden="true" className="h-3" />);
  }
  return <div className="space-y-2 text-base leading-relaxed text-slate-700">{nodes}</div>;
}
