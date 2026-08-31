/** The shape of everything the extractor produces. Keep in sync with markdown.ts + exporters.ts. */

export type ColorRole = 'background' | 'text' | 'border' | 'shadow' | 'accent' | 'svg';

export interface ColorEntry {
  hex: string;
  rgb: string;
  hsl: string;
  oklch: string;
  alpha: number;
  /** Human-readable label derived from hue/saturation/lightness, e.g. "Deep Blue". */
  name: string;
  /** Weighted usage score - background colors are weighted by painted area, text by glyph count. */
  usage: number;
  roles: ColorRole[];
  /**
   * Usage broken down per role. Semantic inference needs this: the most-used
   * color overall is often white, which would win the "border" slot on total
   * usage alone even when it is barely used as a border.
   */
  roleUsage: Partial<Record<ColorRole, number>>;
  contrastOnWhite: number;
  contrastOnBlack: number;
  /** WCAG rating of this color used as text on the page's dominant background. */
  onPageBackground: { contrast: number; rating: string } | null;
}

export interface SemanticTokens {
  background: string | null;
  surface: string | null;
  textPrimary: string | null;
  textMuted: string | null;
  border: string | null;
  primary: string | null;
  accent: string | null;
}

export interface CssVariable {
  name: string;
  value: string;
  /** Resolved to a hex string when the value is a color. */
  hex: string | null;
  scope: string;
}

export interface FontFaceEntry {
  family: string;
  weight: string;
  style: string;
  display: string;
  formats: string[];
  src: string[];
}

export interface FontFamilyEntry {
  /** Full CSS font-family stack as computed. */
  stack: string;
  /** First (preferred) family in the stack. */
  primary: string;
  usage: number;
  weightsUsed: number[];
  sizesUsed: number[];
  roles: string[];
  source: 'google' | 'adobe' | 'self-hosted' | 'system' | 'unknown';
  webfontUrls: string[];
}

export interface TypeRole {
  /** h1..h6, body, lead, small, button, link, label, code, blockquote */
  role: string;
  selector: string;
  fontFamily: string;
  fontSize: number;
  fontSizeRem: number;
  fontWeight: number;
  /** Resolved px value. When the site uses `line-height: normal` this is the browser's ~1.2 estimate. */
  lineHeight: number;
  /** The literal computed value, so `normal` is not silently reported as a number. */
  lineHeightRaw: string;
  lineHeightRatio: number;
  letterSpacing: string;
  textTransform: string;
  color: string;
  count: number;
  sampleText: string;
}

export interface ScaleStep {
  px: number;
  rem: number;
  count: number;
  /** Ratio to the previous step, for spotting a modular scale. */
  ratio: number | null;
}

export interface ShadowEntry {
  value: string;
  count: number;
}

export interface RadiusEntry {
  value: string;
  px: number | null;
  count: number;
}

export interface BorderEntry {
  value: string;
  count: number;
}

export interface SpacingEntry {
  px: number;
  rem: number;
  count: number;
  /** Multiple of the inferred base unit, when it divides cleanly. */
  multiple: number | null;
}

export interface IconEntry {
  kind: 'inline-svg' | 'icon-font' | 'img' | 'favicon' | 'mask';
  /** Sanitized SVG markup, safe to render. Null for non-SVG icons. */
  svg: string | null;
  url: string | null;
  label: string;
  width: number;
  height: number;
  strokeWidth: number | null;
  color: string | null;
  count: number;
}

export interface ComponentStyle {
  name: string;
  selector: string;
  sampleText: string;
  styles: Record<string, string>;
  count: number;
}

export interface SiteMeta {
  url: string;
  finalUrl: string;
  domain: string;
  title: string;
  description: string;
  lang: string;
  charset: string;
  viewport: string;
  themeColor: string;
  ogImage: string;
  generator: string;
  favicons: { rel: string; href: string; sizes: string; type: string }[];
  logo: { kind: string; src: string | null; svg: string | null; alt: string } | null;
}

export interface TechStack {
  frameworks: string[];
  cssFrameworks: string[];
  fontProviders: string[];
  iconSets: string[];
}

export interface LayoutInfo {
  pageBackground: string;
  containerMaxWidths: ScaleStep[];
  breakpoints: { query: string; px: number | null; count: number }[];
  gridUsage: number;
  flexUsage: number;
  documentHeight: number;
}

export interface ExtractWarning {
  code: string;
  message: string;
}

export interface DesignReport {
  meta: SiteMeta;
  tech: TechStack;
  colors: ColorEntry[];
  semantic: SemanticTokens;
  cssVariables: CssVariable[];
  fontFamilies: FontFamilyEntry[];
  fontFaces: FontFaceEntry[];
  typeRoles: TypeRole[];
  typeScale: ScaleStep[];
  spacing: { baseUnit: number | null; steps: SpacingEntry[] };
  radii: RadiusEntry[];
  shadows: ShadowEntry[];
  borders: BorderEntry[];
  gradients: { value: string; count: number }[];
  icons: IconEntry[];
  components: ComponentStyle[];
  layout: LayoutInfo;
  screenshot: string | null;
  stats: {
    elementsScanned: number;
    stylesheetsParsed: number;
    durationMs: number;
    extractedAt: string;
  };
  warnings: ExtractWarning[];
}
