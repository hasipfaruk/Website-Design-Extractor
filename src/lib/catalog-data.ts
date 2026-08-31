export interface CatalogEntry {
  slug: string;
  name: string;
  description: string;
  url: string;
  /** Path relative to the repo root when a ready-made DESIGN.md ships with the app. */
  file?: string;
  sections?: number;
  screens?: number;
}

export interface PublicDesign {
  slug: string;
  name: string;
  description: string;
  url: string;
  ready: boolean;
  sections: number | null;
  screens: number | null;
  command: string;
}

/** Curated references. Do not add new rows unless asked. */
export const CATALOG: CatalogEntry[] = [
  {
    slug: 'getdesign',
    name: 'getdesign.md',
    description: 'Browse independent design system analyses. Void-black canvas, pink chrome, Geist.',
    url: 'https://getdesign.md',
    file: 'designs/getdesign/DESIGN.md',
    sections: 8,
    screens: 1,
  },
  {
    slug: 'mobbin',
    name: 'Mobbin',
    description: 'A library of the best mobile and web design patterns.',
    url: 'https://mobbin.com',
    file: 'DESIGN.md',
    sections: 20,
    screens: 87,
  },
  {
    slug: 'stripe',
    name: 'Stripe',
    description: 'Payment infrastructure. Signature purple gradients, weight-300 elegance.',
    url: 'https://stripe.com',
  },
  {
    slug: 'linear',
    name: 'Linear',
    description: 'Project management. Ultra-minimal, precise, purple accent.',
    url: 'https://linear.app',
  },
  {
    slug: 'vercel',
    name: 'Vercel',
    description: 'Frontend deployment. Black and white precision, Geist font.',
    url: 'https://vercel.com',
  },
  {
    slug: 'notion',
    name: 'Notion',
    description: 'All-in-one workspace. Warm minimalism, serif headings, soft surfaces.',
    url: 'https://www.notion.so',
  },
  {
    slug: 'figma',
    name: 'Figma',
    description: 'Collaborative design tool. Vibrant multi-color, playful yet professional.',
    url: 'https://www.figma.com',
  },
  {
    slug: 'framer',
    name: 'Framer',
    description: 'Website builder. Bold black and blue, motion-first, design-forward.',
    url: 'https://www.framer.com',
  },
  {
    slug: 'github',
    name: 'GitHub',
    description: 'Developer platform. Dark canvas, primer system, monospace accents.',
    url: 'https://github.com',
  },
  {
    slug: 'spotify',
    name: 'Spotify',
    description: 'Music streaming. Vibrant green on dark, bold type, album-art-driven.',
    url: 'https://www.spotify.com',
  },
  {
    slug: 'airbnb',
    name: 'Airbnb',
    description: 'Travel marketplace. Warm coral accent, photography-driven, rounded UI.',
    url: 'https://www.airbnb.com',
  },
  {
    slug: 'apple',
    name: 'Apple',
    description: 'Consumer electronics. Premium white space, SF Pro, cinematic imagery.',
    url: 'https://www.apple.com',
  },
  {
    slug: 'discord',
    name: 'Discord',
    description: 'Team & community chat. Deep-indigo canvas with Blurple gradients.',
    url: 'https://discord.com',
  },
  {
    slug: 'slack',
    name: 'Slack',
    description: 'Workplace messaging. Deep-aubergine primary with cream-lavender gradients.',
    url: 'https://slack.com',
  },
  {
    slug: 'tesla',
    name: 'Tesla',
    description: 'Electric automotive. Radical subtraction, full-viewport photography.',
    url: 'https://www.tesla.com',
  },
  {
    slug: 'claude',
    name: 'Claude',
    description: "Anthropic's AI assistant. Warm terracotta accent, clean editorial layout.",
    url: 'https://claude.ai',
  },
  {
    slug: 'cursor',
    name: 'Cursor',
    description: 'AI-first code editor. Sleek dark interface, gradient accents.',
    url: 'https://cursor.com',
  },
  {
    slug: 'raycast',
    name: 'Raycast',
    description: 'Productivity launcher. Sleek dark chrome, vibrant gradient accents.',
    url: 'https://www.raycast.com',
  },
  {
    slug: 'supabase',
    name: 'Supabase',
    description: 'Open-source Firebase alternative. Dark emerald theme, code-first.',
    url: 'https://supabase.com',
  },
  {
    slug: 'resend',
    name: 'Resend',
    description: 'Email API. Minimal dark theme, monospace accents.',
    url: 'https://resend.com',
  },
  {
    slug: 'cal',
    name: 'Cal.com',
    description: 'Open-source scheduling. Clean neutral UI, developer-oriented simplicity.',
    url: 'https://cal.com',
  },
  {
    slug: 'webflow',
    name: 'Webflow',
    description: 'Visual web builder. Blue-accented, polished marketing site aesthetic.',
    url: 'https://webflow.com',
  },
  {
    slug: 'pinterest',
    name: 'Pinterest',
    description: 'Visual discovery. Red accent, masonry grid, image-first.',
    url: 'https://www.pinterest.com',
  },
  {
    slug: 'uber',
    name: 'Uber',
    description: 'Mobility platform. Bold black and white, tight type, urban energy.',
    url: 'https://www.uber.com',
  },
  {
    slug: 'coinbase',
    name: 'Coinbase',
    description: 'Crypto exchange. Clean blue identity, trust-focused, institutional feel.',
    url: 'https://www.coinbase.com',
  },
  {
    slug: 'shopify',
    name: 'Shopify',
    description: 'E-commerce platform. Dark-first cinematic, neon green accent.',
    url: 'https://www.shopify.com',
  },
  {
    slug: 'ibm',
    name: 'IBM',
    description: 'Enterprise technology. Carbon design system, structured blue palette.',
    url: 'https://www.ibm.com',
  },
  {
    slug: 'intercom',
    name: 'Intercom',
    description: 'Customer messaging. Friendly blue palette, conversational UI patterns.',
    url: 'https://www.intercom.com',
  },
  {
    slug: 'mintlify',
    name: 'Mintlify',
    description: 'Documentation platform. Clean, green-accented, reading-optimized.',
    url: 'https://mintlify.com',
  },
  {
    slug: 'posthog',
    name: 'PostHog',
    description: 'Product analytics. Playful hedgehog branding, developer-friendly dark UI.',
    url: 'https://posthog.com',
  },
  {
    slug: 'runway',
    name: 'Runway',
    description: 'AI video generation. Cinematic dark UI, media-rich layout.',
    url: 'https://runwayml.com',
  },
  {
    slug: 'elevenlabs',
    name: 'ElevenLabs',
    description: 'AI voice platform. Dark cinematic UI, audio-waveform aesthetics.',
    url: 'https://elevenlabs.io',
  },
  {
    slug: 'ollama',
    name: 'Ollama',
    description: 'Run LLMs locally. Terminal-first, monochrome simplicity.',
    url: 'https://ollama.com',
  },
];

export const SLUG_RE = /^[a-z0-9][a-z0-9-]{0,63}$/;

export function findCatalogEntry(slug: string): CatalogEntry | undefined {
  return CATALOG.find((e) => e.slug === slug);
}

/** `stripe.com` / `https://linear.app/foo` → `stripe` / `linear`. */
export function slugFromUrl(input: string): string {
  try {
    const host = new URL(input.includes('://') ? input : `https://${input}`).hostname
      .replace(/^www\./, '')
      .toLowerCase();
    const base = host.split('.')[0] ?? host;
    return base.replace(/[^a-z0-9-]/g, '') || 'site';
  } catch {
    return 'site';
  }
}

