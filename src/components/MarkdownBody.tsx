import type { ReactNode } from 'react';

function inline(text: string): ReactNode[] {
  const parts: ReactNode[] = [];
  const re = /(\*\*[^*]+\*\*|`[^`]+`|\[[^\]]+\]\([^)]+\))/g;
  let last = 0;
  let match: RegExpExecArray | null;
  let i = 0;
  while ((match = re.exec(text))) {
    if (match.index > last) parts.push(text.slice(last, match.index));
    const token = match[0];
    if (token.startsWith('**')) {
      parts.push(<strong key={i++}>{token.slice(2, -2)}</strong>);
    } else if (token.startsWith('`')) {
      parts.push(<code key={i++}>{token.slice(1, -1)}</code>);
    } else {
      const link = token.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
      if (link) {
        parts.push(
          <a key={i++} href={link[2]} target="_blank" rel="noopener noreferrer nofollow">
            {link[1]}
          </a>,
        );
      } else {
        parts.push(token);
      }
    }
    last = match.index + token.length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts;
}

function isTableRow(line: string): boolean {
  return /^\s*\|.+\|\s*$/.test(line);
}

function isTableDivider(line: string): boolean {
  return /^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?\s*$/.test(line);
}

function cells(line: string): string[] {
  return line
    .trim()
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split('|')
    .map((c) => c.trim());
}

export default function MarkdownBody({ text }: { text: string }) {
  const lines = text.replace(/\r\n/g, '\n').split('\n');
  const blocks: ReactNode[] = [];
  let i = 0;
  let key = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (!line.trim()) {
      i++;
      continue;
    }

    if (isTableRow(line) && i + 1 < lines.length && isTableDivider(lines[i + 1])) {
      const headers = cells(line);
      i += 2;
      const rows: string[][] = [];
      while (i < lines.length && isTableRow(lines[i])) {
        rows.push(cells(lines[i]));
        i++;
      }
      blocks.push(
        <div className="table-wrap" key={key++}>
          <table>
            <thead>
              <tr>
                {headers.map((h) => (
                  <th key={h}>{inline(h)}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, ri) => (
                <tr key={ri}>
                  {row.map((cell, ci) => (
                    <td key={ci}>{inline(cell)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>,
      );
      continue;
    }

    const heading = line.match(/^(#{2,4})\s+(.+)$/);
    if (heading) {
      const level = heading[1].length;
      const Tag = (level === 2 ? 'h3' : level === 3 ? 'h4' : 'h5') as 'h3' | 'h4' | 'h5';
      blocks.push(<Tag key={key++}>{inline(heading[2])}</Tag>);
      i++;
      continue;
    }

    if (/^\s*[-*]\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*[-*]\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*[-*]\s+/, ''));
        i++;
      }
      blocks.push(
        <ul key={key++}>
          {items.map((item, ii) => (
            <li key={ii}>{inline(item)}</li>
          ))}
        </ul>,
      );
      continue;
    }

    const para: string[] = [];
    while (i < lines.length && lines[i].trim() && !lines[i].startsWith('#') && !/^\s*[-*]\s+/.test(lines[i]) && !isTableRow(lines[i])) {
      para.push(lines[i]);
      i++;
    }
    if (para.length) {
      blocks.push(<p key={key++}>{inline(para.join(' '))}</p>);
    }
  }

  return <div className="docs-prose">{blocks}</div>;
}
