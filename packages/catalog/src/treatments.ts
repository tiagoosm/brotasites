// Photo treatments in plain CSS, applied to a <figure class="photo photo-{id}"> that wraps
// the <img>. They read the palette and shape variables, use no url() except the site's own
// grain file, and never hide the photo's content behind text.

export interface ImageTreatment {
  id: string;
  /** Needs a photo with a clear subject (cut-out and masks crop hard). */
  needsGoodPhoto: boolean;
  css: string;
}

/**
 * Where the grain file is, relative to the site stylesheet (both live in /assets/), so the
 * same CSS works when a site is served under a sub-path.
 */
export const GRAIN_ASSET_PATH = "grain.svg";

/** Film grain as a tiny SVG noise file (an image, so it runs no script). */
export const GRAIN_SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 200 200"><filter id="g"><feTurbulence type="fractalNoise" baseFrequency=".85" numOctaves="3" stitchTiles="stitch"/><feColorMatrix values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 .55 0"/></filter><rect width="200" height="200" filter="url(#g)"/></svg>';

const base =
  ".photo{position:relative;margin:0;isolation:isolate}.photo img{display:block;width:100%;height:auto;border-radius:var(--radius-image)}";

export const imageTreatments: readonly ImageTreatment[] = [
  { id: "none", needsGoodPhoto: false, css: "" },
  {
    id: "offset-frame",
    needsGoodPhoto: false,
    css: '.photo-offset-frame::before{content:"";position:absolute;inset:0;translate:min(14px,3vw) min(14px,3vw);border:2px solid var(--color-accent);border-radius:var(--radius-image);z-index:-1}',
  },
  {
    id: "color-block",
    needsGoodPhoto: false,
    css: '.photo-color-block::before{content:"";position:absolute;inset:12% 18% -16px -16px;background:var(--color-accent);border-radius:var(--radius-image);z-index:-1}',
  },
  {
    id: "polaroid",
    needsGoodPhoto: false,
    css: ".photo-polaroid{background:var(--color-surface);padding:12px 12px 44px;box-shadow:0 10px 30px rgb(0 0 0 / .14);rotate:-2deg}.photo-polaroid img{border-radius:2px}",
  },
  {
    id: "stamp",
    needsGoodPhoto: false,
    css: ".photo-stamp{background:var(--color-surface);padding:12px;mask:linear-gradient(#000 0 0) content-box,radial-gradient(circle,#0000 0 5px,#000 5.5px) -8px -8px/16px 16px}.photo-stamp img{border-radius:0}",
  },
  {
    id: "tilt",
    needsGoodPhoto: false,
    css: ".photo-tilt{rotate:2deg}.photo-tilt img{box-shadow:0 12px 32px rgb(0 0 0 / .16)}",
  },
  {
    id: "duotone",
    needsGoodPhoto: false,
    css: ".photo-duotone{background:var(--color-primary);border-radius:var(--radius-image)}.photo-duotone img{filter:grayscale(1) contrast(1.15);mix-blend-mode:multiply}",
  },
  {
    id: "grain",
    needsGoodPhoto: false,
    css: `.photo-grain::after{content:"";position:absolute;inset:0;background:url("${GRAIN_ASSET_PATH}");opacity:.35;mix-blend-mode:overlay;border-radius:var(--radius-image);pointer-events:none}`,
  },
  {
    id: "arch-mask",
    needsGoodPhoto: true,
    css: ".photo-arch-mask img{border-radius:999px 999px var(--radius-md) var(--radius-md);aspect-ratio:4/5;object-fit:cover}",
  },
  {
    id: "circle-mask",
    needsGoodPhoto: true,
    css: ".photo-circle-mask img{border-radius:50%;aspect-ratio:1;object-fit:cover}",
  },
];

/** The CSS a site needs for one treatment, with the shared base rules. */
export function treatmentCss(treatment: ImageTreatment): string {
  return `${base}${treatment.css}`;
}
