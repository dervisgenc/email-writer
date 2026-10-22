// HTML templates for the store images. Playwright renders them at their exact pixel size;
// the raw screenshots are captured at 2×, so they stay sharp when scaled down.

/**
 * The window in the frame is 1120 px wide. The browser is captured at the same aspect ratio:
 * the mailbox at 1280 px wide (Outlook's desktop layout), the extension's own pages at
 * 960 px so their content stays readable.
 */
const SCREEN_WIDTH = 1120;
const SCREEN_HEIGHT = 678;
export const browserViewport = (width = 1280) => ({
  width,
  height: Math.round((width * SCREEN_HEIGHT) / SCREEN_WIDTH),
});

export const SIZES = {
  screenshot: { width: 1280, height: 800 },
  smallPromo: { width: 440, height: 280 },
  marquee: { width: 1400, height: 560 },
  social: { width: 1280, height: 640 },
  videoThumbnail: { width: 1280, height: 720 },
};

export const FONT = `'Segoe UI Variable Display', 'Segoe UI', -apple-system, BlinkMacSystemFont, system-ui, sans-serif`;

/** The same gradient as the icon, with a few soft light spots for depth. */
export const BACKDROP = `
  radial-gradient(circle at 12% 0%, rgb(255 255 255 / 0.22), transparent 42%),
  radial-gradient(circle at 92% 100%, rgb(120 90 255 / 0.35), transparent 48%),
  linear-gradient(135deg, #2b8be0, #3d4fbf)`;

const page = (size, body, style = '') => `<!doctype html><html><head><meta charset="utf-8"><style>
  * { box-sizing: border-box; }
  html, body { margin: 0; width: ${size.width}px; height: ${size.height}px; overflow: hidden; }
  body { position: relative; font-family: ${FONT}; color: #fff; background: ${BACKDROP}; -webkit-font-smoothing: antialiased; }
  .window { position: absolute; overflow: hidden; background: #fff;
    box-shadow: 0 0 0 1px rgb(255 255 255 / 0.25), 0 24px 64px rgb(8 20 60 / 0.45); }
  .window img { display: block; width: 100%; }
  ${style}
</style></head><body>${body}</body></html>`;

/** Captioned screenshot: title and description at the top, the window running off the bottom edge. */
export function screenshotFrame({ title, text, image }) {
  const { width, height } = SIZES.screenshot;
  const left = (width - SCREEN_WIDTH) / 2;
  return page(
    SIZES.screenshot,
    `<h1>${title}</h1><p>${text}</p>
     <div class="window" style="left:${left}px;top:${height - SCREEN_HEIGHT}px;width:${SCREEN_WIDTH}px;height:${SCREEN_HEIGHT}px">
       <img src="${image}"></div>`,
    `h1 { margin: 0; padding-top: 22px; text-align: center; font-size: 34px; line-height: 44px; font-weight: 700; letter-spacing: -0.01em; }
     p { margin: 6px 0 0; text-align: center; font-size: 18px; line-height: 26px; opacity: 0.9; }
     .window { border-radius: 12px 12px 0 0; }`,
  );
}

const lockup = (icon, iconSize, nameSize) =>
  `<div class="lockup"><img src="${icon}" style="width:${iconSize}px;height:${iconSize}px">
     <span style="font-size:${nameSize}px">Writehand</span></div>`;

const LOCKUP_STYLE = `
  .lockup { display: flex; align-items: center; gap: 0.4em; font-weight: 700; letter-spacing: -0.02em; }
  .lockup img { filter: drop-shadow(0 6px 16px rgb(8 20 60 / 0.35)); border-radius: 22%; }`;

/** Small promo tile (Chrome Web Store and Edge Add-ons, 440×280). */
export function smallPromoTile({ icon }) {
  return page(
    SIZES.smallPromo,
    `<div class="content">${lockup(icon, 76, 42)}<p>AI email writing for Outlook on the web</p></div>`,
    `${LOCKUP_STYLE}
     .content { position: absolute; inset: 0; display: flex; flex-direction: column; justify-content: center; padding: 0 36px; }
     .lockup { gap: 16px; }
     p { margin: 18px 0 0; font-size: 20px; line-height: 27px; font-weight: 600; opacity: 0.95; }`,
  );
}

/**
 * Wide promo image: name and features on the left, a crop of a screenshot on the right.
 * `crop` is the region of the raw image to show (CSS pixels); it is scaled down to fit the
 * space to the right of the text and sits against the right and bottom edges.
 */
function bannerWithShot(size, { icon, image, crop }) {
  const textLeft = 72;
  const textWidth = Math.round(size.width * 0.42);
  const left = textLeft + textWidth + 48;
  const width = size.width - left;
  const scale = width / crop.width;
  const top = Math.max(48, Math.round(size.height - crop.height * scale));
  return page(
    size,
    `<div class="text">
       ${lockup(icon, 72, 52)}
       <h1>Write better emails<br>in Outlook on the web</h1>
       <ul><li>Reply</li><li>Revise</li><li>Translate</li><li>Tables &amp; charts</li></ul>
       <p>Your own API key, ChatGPT plan or Claude Code<br>Free and open source</p>
     </div>
     <div class="window" style="left:${left}px;top:${top}px;width:${width}px;height:${size.height - top}px">
       <img src="${image}" style="width:${browserViewport().width * scale}px;max-width:none;margin:${-crop.y * scale}px 0 0 ${-crop.x * scale}px"></div>`,
    `${LOCKUP_STYLE}
     .text { position: absolute; left: ${textLeft}px; top: 0; bottom: 0; width: ${textWidth}px; display: flex; flex-direction: column; justify-content: center; }
     .lockup { gap: 18px; }
     h1 { margin: 26px 0 0; font-size: 34px; line-height: 42px; font-weight: 700; letter-spacing: -0.01em; }
     ul { display: flex; flex-wrap: wrap; gap: 8px; margin: 22px 0 0; padding: 0; list-style: none; }
     li { padding: 6px 14px; border-radius: 999px; background: rgb(255 255 255 / 0.16); box-shadow: inset 0 0 0 1px rgb(255 255 255 / 0.3); font-size: 16px; font-weight: 600; }
     p { margin: 22px 0 0; font-size: 16px; line-height: 23px; opacity: 0.9; }
     .window { border-radius: 14px 0 0 0; }`,
  );
}

export const marqueeTile = (options) => bannerWithShot(SIZES.marquee, options);
export const socialPreview = (options) => bannerWithShot(SIZES.social, options);
export const videoThumbnail = (options) => bannerWithShot(SIZES.videoThumbnail, options);
