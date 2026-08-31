'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { PublicDesign } from '@/lib/catalog-data';

export type CatalogDesign = Pick<
  PublicDesign,
  'slug' | 'name' | 'description' | 'url' | 'ready' | 'sections' | 'screens'
>;

function hostname(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return '';
  }
}

function BrandLogo({ name, url }: { name: string; url: string }) {
  const [failed, setFailed] = useState(false);
  const host = hostname(url);
  const src = host ? `https://www.google.com/s2/favicons?domain=${encodeURIComponent(host)}&sz=128` : '';
  const letter = (name.trim()[0] || '?').toUpperCase();

  if (!src || failed) {
    return <span className="brand-mark">{letter}</span>;
  }

  return (
    <span className="brand-mark brand-logo">
      {/* Third-party favicon; next/image cannot optimize an unknown host list. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt=""
        width={22}
        height={22}
        decoding="async"
        referrerPolicy="no-referrer"
        onError={() => setFailed(true)}
      />
    </span>
  );
}

export default function Catalog({
  designs,
  query,
  busySlug,
  selectedSlug,
  onSelect,
  onAdd,
}: {
  designs: CatalogDesign[];
  query: string;
  busySlug: string | null;
  selectedSlug: string;
  onSelect: (slug: string) => void;
  onAdd: (design: CatalogDesign) => void;
}) {
  const router = useRouter();
  const q = query.trim().toLowerCase();
  const rows = q
    ? designs.filter(
        (d) =>
          d.name.toLowerCase().includes(q) ||
          d.slug.includes(q) ||
          d.description.toLowerCase().includes(q),
      )
    : designs;

  return (
    <section className="catalog" id="catalog">
      <div className="catalog-head">
        <div>
          <h2>Select a design</h2>
          <p>Open the analysis, or download <code>design.md</code>.</p>
        </div>
      </div>
      {busySlug ? (
        <p className="catalog-busy">Building design.md for {busySlug}… this can take up to a minute the first time.</p>
      ) : null}

      <div className="catalog-table-wrap">
        <table className="catalog-table">
          <thead>
            <tr>
              <th className="col-icon"> </th>
              <th>Name</th>
              <th>Description</th>
              <th className="col-num">Sections</th>
              <th className="col-num">Screens</th>
              <th className="col-act"> </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((d) => {
              const active = selectedSlug === d.slug;
              const busy = busySlug === d.slug;
              return (
                <tr
                  key={d.slug}
                  className={active ? 'is-active' : undefined}
                  tabIndex={0}
                  role="link"
                  onClick={() => {
                    onSelect(d.slug);
                    router.push(`/d/${d.slug}`);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      onSelect(d.slug);
                      router.push(`/d/${d.slug}`);
                    }
                  }}
                >
                  <td className="col-icon">
                    <Link href={`/d/${d.slug}`} onClick={(e) => e.stopPropagation()}>
                      <BrandLogo name={d.name} url={d.url} />
                    </Link>
                  </td>
                  <td>
                    <Link className="brand-link" href={`/d/${d.slug}`} onClick={(e) => e.stopPropagation()}>
                      <div className="brand-name">
                        {d.name}
                        {d.ready ? <span className="ready-dot" title="Ready to download" /> : null}
                      </div>
                      <div className="brand-slug">{d.slug}</div>
                    </Link>
                  </td>
                  <td className="wrap">{d.description}</td>
                  <td className="col-num">{d.sections ?? '—'}</td>
                  <td className="col-num">{d.screens ?? '—'}</td>
                  <td className="col-act">
                    <button
                      type="button"
                      className="icon-btn"
                      title={`Download design.md for ${d.name}`}
                      disabled={!!busySlug}
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelect(d.slug);
                        onAdd(d);
                      }}
                    >
                      {busy ? '…' : '+'}
                    </button>
                  </td>
                </tr>
              );
            })}
            {!rows.length && (
              <tr>
                <td colSpan={6} className="empty-row">
                  No references match “{query}”.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
