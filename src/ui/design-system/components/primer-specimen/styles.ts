/**
 * Shared styling for the primer-specimen components — the reusable foundation
 * specimens (colour ramps, swatch grids, type scale, spacing bars, glyph grids,
 * box rows, definition lists, layout mocks). Ported from the
 * Display Case design system's primer wall text and generalised so any consumer
 * can build their own Primer from these primitives.
 *
 * Like the other design-system components, the specimens are self-contained:
 * importing any one of them pulls in this stylesheet once (via
 * {@link injectStyle}). Every value is a `--dc-*` token; nothing is hard-coded.
 * No-ops under SSR / Node. The `dcpl-` prefix ("display case primer") keeps
 * these class names clear of the `dcui-*` component styles and the `dc-*`
 * browse-chrome styles.
 */
import { injectStyle } from '../inject-style'

const CSS = `
/* Full-width specimen block — stacks inside a flex body. */
.dcpl-block { width: 100%; }
.dcpl-row {
  display: flex; flex-wrap: wrap; gap: var(--dc-space-8); align-items: center;
  width: 100%;
}

/* Colour ramp. */
.dcpl-ramp { display: grid; gap: var(--dc-space-3); width: 100%; }
.dcpl-sw { min-width: 0; }
.dcpl-sw-chip {
  border-radius: var(--dc-radius-sm);
  border: var(--dc-border-line);
}
.dcpl-sw-meta { margin-top: var(--dc-space-2); }
.dcpl-sw-name {
  font-family: var(--dc-font-sans); font-size: var(--dc-text-sm);
  font-weight: var(--dc-weight-medium); color: var(--dc-fg);
}
.dcpl-sw-star { color: var(--dc-brand); }
.dcpl-sw-hex {
  font-family: var(--dc-font-mono); font-size: var(--dc-text-xs);
  color: var(--dc-fg-muted);
}

/* Semantic role swatch grid. */
.dcpl-swgrid { display: grid; gap: var(--dc-space-6); width: 100%; }
.dcpl-swrow { display: flex; align-items: center; gap: var(--dc-space-4); }
.dcpl-swchip {
  width: 28px; height: 28px; flex: 0 0 auto;
  border-radius: var(--dc-radius-sm); border: var(--dc-border-line);
}
.dcpl-swtok { font-family: var(--dc-font-mono); font-size: var(--dc-text-xs); min-width: 0; }
.dcpl-swtok b {
  display: block; font-family: var(--dc-font-sans);
  font-weight: var(--dc-weight-medium); font-size: var(--dc-text-sm); color: var(--dc-fg);
}
.dcpl-swtok span { color: var(--dc-fg-muted); }

/* Status list. */
.dcpl-status { display: flex; gap: var(--dc-space-6); flex-wrap: wrap; width: 100%; }
.dcpl-statusitem {
  flex: 1; min-width: 9rem; display: flex; align-items: center; gap: var(--dc-space-4);
  border: var(--dc-border-line); border-radius: var(--dc-radius-sm); padding: var(--dc-space-6);
}
.dcpl-statusdot { width: 14px; height: 14px; border-radius: var(--dc-radius-full); flex: 0 0 auto; }
.dcpl-statusitem b { display: block; font-size: var(--dc-text-sm); font-weight: var(--dc-weight-medium); color: var(--dc-fg); }
.dcpl-statusitem span { font-family: var(--dc-font-mono); font-size: var(--dc-text-xs); color: var(--dc-fg-muted); }

/* Definition list. */
.dcpl-deflist {
  border: var(--dc-border-line); border-radius: var(--dc-radius-md);
  /* border-box so width:100% includes the border — otherwise the right border
     overflows its parent and is clipped when the list fills a flush Display. */
  box-sizing: border-box;
  overflow: hidden; width: 100%;
}
.dcpl-defrow {
  display: grid; gap: var(--dc-space-8);
  padding: var(--dc-space-6) var(--dc-space-8); border-top: var(--dc-border-line);
}
.dcpl-defrow:first-child { border-top: 0; }
.dcpl-defterm {
  font-family: var(--dc-font-mono); font-size: var(--dc-text-xs);
  font-weight: var(--dc-weight-medium); letter-spacing: var(--dc-tracking-label);
  text-transform: uppercase; color: var(--dc-brand);
}
.dcpl-defdesc { font-size: var(--dc-text-sm); line-height: var(--dc-leading-normal); color: var(--dc-fg-muted); }
.dcpl-defdesc strong { color: var(--dc-fg); font-weight: var(--dc-weight-semibold); }

/* Layout mock. */
.dcpl-layout {
  width: 100%; max-width: 26rem; border: var(--dc-border-line);
  border-radius: var(--dc-radius-md); overflow: hidden;
  font-family: var(--dc-font-mono); font-size: var(--dc-text-xs); color: var(--dc-fg-muted);
}
.dcpl-layout-head { padding: var(--dc-space-4) var(--dc-space-5); border-bottom: var(--dc-border-line); background: var(--dc-bg); }
.dcpl-layout-body { display: flex; min-height: 72px; }
.dcpl-layout-side { width: 32%; padding: var(--dc-space-5); border-right: var(--dc-border-line); background: var(--dc-bg-subtle); }
.dcpl-layout-main { flex: 1; padding: var(--dc-space-5); background: var(--dc-surface); }

/* Type families. */
.dcpl-fam { display: flex; flex-direction: column; gap: var(--dc-space-8); width: 100%; }
.dcpl-famrow { display: flex; align-items: baseline; gap: var(--dc-space-8); flex-wrap: wrap; }
.dcpl-famtag {
  font-family: var(--dc-font-mono); font-size: var(--dc-text-xs);
  font-weight: var(--dc-weight-medium); letter-spacing: var(--dc-tracking-label);
  text-transform: uppercase; color: var(--dc-fg-muted); width: 6.5rem; flex: 0 0 auto;
}
.dcpl-famsample { font-size: 23px; color: var(--dc-fg); }
.dcpl-famsample[data-font="mono"] { font-family: var(--dc-font-mono); font-size: 21px; }
.dcpl-famsample[data-font="sans"] { font-family: var(--dc-font-sans); }
.dcpl-famnote { font-family: var(--dc-font-mono); font-size: var(--dc-text-xs); color: var(--dc-fg-subtle); margin-top: var(--dc-space-1); }

/* Type scale. */
.dcpl-scale { display: flex; flex-direction: column; gap: var(--dc-space-6); width: 100%; }
.dcpl-scalerow { display: flex; align-items: baseline; gap: var(--dc-space-8); }
.dcpl-scaletag { font-family: var(--dc-font-mono); font-size: var(--dc-text-xs); color: var(--dc-fg-muted); width: 6rem; flex: 0 0 auto; }
.dcpl-scalespec { line-height: var(--dc-leading-tight); color: var(--dc-fg); }

/* Weights. */
.dcpl-weights { display: flex; gap: var(--dc-space-16); align-items: baseline; flex-wrap: wrap; width: 100%; }
.dcpl-weight { font-size: 22px; color: var(--dc-fg); }
.dcpl-weight span { display: block; font-size: var(--dc-text-xs); color: var(--dc-fg-muted); font-weight: var(--dc-weight-normal); margin-top: var(--dc-space-1); }
.dcpl-divider { height: 1px; background: var(--dc-border); margin: var(--dc-space-8) 0; width: 100%; }

/* Spacing scale. */
.dcpl-spacescale { display: flex; flex-direction: column; gap: var(--dc-space-4); width: 100%; }
.dcpl-spacerow { display: flex; align-items: center; gap: var(--dc-space-6); }
.dcpl-spacetag { font-family: var(--dc-font-mono); font-size: var(--dc-text-xs); color: var(--dc-fg-muted); width: 4.5rem; flex: 0 0 auto; }
.dcpl-spacepx { font-family: var(--dc-font-mono); font-size: var(--dc-text-xs); color: var(--dc-fg-subtle); width: 2.75rem; flex: 0 0 auto; }
.dcpl-spacebar { height: 12px; background: var(--dc-brand); border-radius: var(--dc-radius-sm); }

/* Box row (radius, elevation, any labelled box specimen). */
.dcpl-boxrow { display: flex; gap: var(--dc-space-10); flex-wrap: wrap; width: 100%; }
.dcpl-boxitem { display: flex; flex-direction: column; align-items: center; gap: var(--dc-space-4); }
.dcpl-box {
  width: 64px; height: 48px; background: var(--dc-bg-subtle); border: var(--dc-border-line);
  display: flex; align-items: center; justify-content: center;
  font-size: var(--dc-text-sm); color: var(--dc-fg-muted);
}
.dcpl-boxlbl { text-align: center; }
.dcpl-boxlbl b { display: block; font-size: var(--dc-text-sm); font-weight: var(--dc-weight-medium); color: var(--dc-fg); }
.dcpl-boxlbl span { font-family: var(--dc-font-mono); font-size: var(--dc-text-xs); color: var(--dc-fg-muted); }

/* Glyph grid. */
.dcpl-icongrid { display: grid; gap: var(--dc-space-6); width: 100%; }
.dcpl-iconitem {
  display: flex; flex-direction: column; align-items: center; gap: var(--dc-space-3);
  border: var(--dc-border-line); border-radius: var(--dc-radius-sm); padding: var(--dc-space-6) var(--dc-space-3);
}
.dcpl-iconglyph { font-size: var(--dc-text-lg); line-height: 1; color: var(--dc-fg); }
.dcpl-iconuse { font-size: var(--dc-text-xs); color: var(--dc-fg-muted); text-align: center; }

/* Components overview — labelled rows grouping a whole component category
   (one row per member: a mono tag on the left, live specimens on the right). */
.dcpl-overview { display: flex; flex-direction: column; gap: var(--dc-space-10); width: 100%; }
.dcpl-ovrow { display: grid; grid-template-columns: 4.5rem 1fr; gap: var(--dc-space-8); align-items: center; }
.dcpl-ovrow[data-align="start"] { align-items: start; }
.dcpl-ovlabel {
  font-family: var(--dc-font-mono); font-size: var(--dc-text-xs);
  font-weight: var(--dc-weight-medium); letter-spacing: var(--dc-tracking-label);
  text-transform: uppercase; color: var(--dc-fg-muted); line-height: var(--dc-leading-tight);
}
.dcpl-ovitems { display: flex; flex-wrap: wrap; gap: var(--dc-space-6); align-items: center; min-width: 0; }

/* Showcase overview — labelled sections stacked vertically, each label sitting
   above its specimen. The sidebar + stage pair share a two-column top row; the
   docked + floating tweaks panels stack in one section. */
.dcpl-sc { display: flex; flex-direction: column; gap: var(--dc-space-10); width: 100%; }
.dcpl-sc-block { display: flex; flex-direction: column; gap: var(--dc-space-4); min-width: 0; min-height: 0; }
.dcpl-sc-cols {
  display: grid; grid-template-columns: auto minmax(0, 1fr);
  gap: var(--dc-space-10); align-items: start;
}
/* Pair variant — the left column stacks two specimens (sidebar above eyebrow)
   and the right specimen (stage) stretches to their combined height. */
.dcpl-sc-cols[data-pair] { align-items: stretch; }
.dcpl-sc-stack { display: flex; flex-direction: column; gap: var(--dc-space-10); min-width: 0; }
.dcpl-sc-tweaks { display: flex; flex-direction: column; gap: var(--dc-space-8); width: 100%; }
/* The floating panel uses position:fixed; the transform makes this surface its
   containing block so it anchors to this corner instead of the viewport. */
.dcpl-sc-float {
  position: relative; transform: translateZ(0);
  display: flex; align-items: center; justify-content: center;
  min-height: 12rem; width: 100%;
  border: 1px dashed var(--dc-border); border-radius: var(--dc-radius-md);
  font-family: var(--dc-font-mono); font-size: var(--dc-text-sm); color: var(--dc-fg-subtle);
}

@media (max-width: 680px) {
  .dcpl-defrow { grid-template-columns: 1fr !important; gap: var(--dc-space-2); }
  .dcpl-ovrow { grid-template-columns: 1fr !important; gap: var(--dc-space-3); }
  .dcpl-sc-cols { grid-template-columns: 1fr; }
}
`

injectStyle('dcpl-specimens', CSS)
