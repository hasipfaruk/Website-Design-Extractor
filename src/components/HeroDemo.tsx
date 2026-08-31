'use client';

/** Looping before/after demo — generic AI layout vs the same UI after design.md. */
export default function HeroDemo() {
  return (
    <div className="hero-demo" aria-label="Animation: generic AI layout becoming a designed interface">
      <div className="demo-stage">
        <article className="demo-card is-before">
          <span className="demo-tag">Without design.md</span>
          <div className="demo-nav">
            <i />
            <i />
            <i />
          </div>
          <div className="demo-hero-bar" />
          <div className="demo-lines">
            <b />
            <b />
            <b className="short" />
          </div>
          <div className="demo-row">
            <div className="demo-tile" />
            <div className="demo-tile" />
          </div>
          <div className="demo-cta" />
        </article>

        <div className="demo-arrow" aria-hidden>
          <span />
        </div>

        <article className="demo-card is-after">
          <span className="demo-tag">With design.md</span>
          <div className="demo-nav">
            <strong>WebSift</strong>
            <span>Catalog</span>
            <em>Start</em>
          </div>
          <h3>Ship a real look.</h3>
          <p>Colors, type and spacing stay consistent on every page.</p>
          <div className="demo-row">
            <div className="demo-tile filled">
              <small>Primary</small>
              <b>#ffb1ee</b>
            </div>
            <div className="demo-tile filled alt">
              <small>Canvas</small>
              <b>#000000</b>
            </div>
          </div>
          <button type="button" tabIndex={-1}>
            Download design.md
          </button>
        </article>
      </div>
      <p className="demo-caption">How it works — generic AI output, then the same screen after a design.md</p>
    </div>
  );
}
