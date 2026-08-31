export interface DesignColor {
  token: string;
  hex: string;
}

export interface DesignType {
  token: string;
  fontFamily: string;
  fontSize: string;
  fontWeight: string;
  lineHeight: string;
  letterSpacing: string;
}

export interface DesignComponent {
  name: string;
  props: { key: string; value: string }[];
}

export interface MdSection {
  id: string;
  title: string;
  body: string;
}

export interface DesignViewModel {
  name: string;
  description: string;
  colors: DesignColor[];
  typography: DesignType[];
  rounded: { token: string; value: string }[];
  spacing: { token: string; value: string }[];
  components: DesignComponent[];
  sections: MdSection[];
  markdown: string;
}

function unquote(value: string): string {
  const v = value.trim();
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
    try {
      return JSON.parse(v);
    } catch {
      return v.slice(1, -1);
    }
  }
  return v;
}

function sectionBlock(front: string, name: string): string {
  const start = front.match(new RegExp(`^${name}:\\s*$`, 'm'));
  if (!start || start.index === undefined) return '';
  const rest = front.slice(start.index + start[0].length);
  const next = rest.search(/^\w[\w-]*:/m);
  return (next === -1 ? rest : rest.slice(0, next)).replace(/^\r?\n/, '');
}

function flatMap(block: string): { token: string; value: string }[] {
  return block
    .split('\n')
    .map((line) => line.match(/^  ([A-Za-z0-9_-]+):\s*(.+)$/))
    .filter((m): m is RegExpMatchArray => !!m)
    .map((m) => ({ token: m[1], value: unquote(m[2]) }));
}

function nestedMap(block: string): DesignType[] {
  const items: DesignType[] = [];
  let current: DesignType | null = null;
  for (const raw of block.split('\n')) {
    const head = raw.match(/^  ([A-Za-z0-9_-]+):\s*$/);
    if (head) {
      current = {
        token: head[1],
        fontFamily: 'Geist',
        fontSize: '16px',
        fontWeight: '400',
        lineHeight: '1.4',
        letterSpacing: '0',
      };
      items.push(current);
      continue;
    }
    const prop = raw.match(/^    ([A-Za-z0-9_-]+):\s*(.+)$/);
    if (prop && current) {
      const key = prop[1];
      const val = unquote(prop[2]);
      if (key === 'fontFamily') current.fontFamily = val;
      if (key === 'fontSize') current.fontSize = val;
      if (key === 'fontWeight') current.fontWeight = val;
      if (key === 'lineHeight') current.lineHeight = val;
      if (key === 'letterSpacing') current.letterSpacing = val;
    }
  }
  return items;
}

function componentMap(block: string): DesignComponent[] {
  const items: DesignComponent[] = [];
  let current: DesignComponent | null = null;
  for (const raw of block.split('\n')) {
    const head = raw.match(/^  ([A-Za-z0-9_-]+):\s*$/);
    if (head) {
      current = { name: head[1], props: [] };
      items.push(current);
      continue;
    }
    const prop = raw.match(/^    ([A-Za-z0-9_-]+):\s*(.+)$/);
    if (prop && current) {
      current.props.push({ key: prop[1], value: unquote(prop[2]) });
    }
  }
  return items;
}

function slugify(title: string): string {
  return title
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '') || 'section';
}

function bodySections(markdown: string): MdSection[] {
  const body = markdown.replace(/^---\n[\s\S]*?\n---\n*/, '');
  const parts = body.split(/^## /m).map((p) => p.trim()).filter(Boolean);
  return parts.map((part) => {
    const nl = part.indexOf('\n');
    const title = (nl === -1 ? part : part.slice(0, nl)).trim();
    const text = nl === -1 ? '' : part.slice(nl + 1).trim();
    return { id: slugify(title), title, body: text };
  });
}

export function parseDesignMd(markdown: string): DesignViewModel {
  const match = markdown.match(/^---\n([\s\S]*?)\n---/);
  const front = match?.[1] ?? '';
  const nameLine = front.match(/^name:\s*(.+)$/m)?.[1];
  const descLine = front.match(/^description:\s*(.+)$/m)?.[1];

  return {
    name: nameLine ? unquote(nameLine).replace(/\s+Analysis$/i, '') : 'Design system',
    description: descLine ? unquote(descLine) : '',
    colors: flatMap(sectionBlock(front, 'colors')).map((c) => ({ token: c.token, hex: c.value })),
    typography: nestedMap(sectionBlock(front, 'typography')),
    rounded: flatMap(sectionBlock(front, 'rounded')),
    spacing: flatMap(sectionBlock(front, 'spacing')),
    components: componentMap(sectionBlock(front, 'components')),
    sections: bodySections(markdown),
    markdown,
  };
}
