# Recording the animated ads to video

Two standalone, branded animations are ready to screen-record:

| File | Ratio | Pixel size | Best for |
|------|-------|-----------|----------|
| `ad-square.html`   | 1:1  | 1080×1080 | Instagram/Facebook feed posts |
| `ad-vertical.html` | 9:16 | 1080×1920 | Reels, TikTok, Shorts, WhatsApp Status, Stories |

Both loop through 4 niche/country scenarios (Dentists/Texas, Roofers/London,
Restaurants/Toronto, Real estate/Sydney). One full loop ≈ 24 seconds.

## How to record (Windows)

1. Open the file in **Chrome** (double-click it).
2. Press **F11** for fullscreen. The animation sits centered on a dark
   background, perfectly cropped to its ratio.
3. Record:
   - **Xbox Game Bar:** `Win + Alt + R` to start/stop (saves an .mp4).
   - or **ScreenToGif** (free) — lets you draw a box exactly around the
     animation and export .mp4 or .gif.
4. Record at least one full loop (~24s). Trim the ends in any editor.

## Customize before recording

- **Brand name / URL / handle:** edit the `[Your Business Name]`,
  `[your-website.com]`, and `[@yourhandle]` placeholders in each HTML file.
- **Scenarios shown:** edit the `SCENES` array in `ad-animation.js`
  (shared by both files).
- **Headline:** edit the `.head h1` text in each HTML file.

## Tip for a pixel-perfect 1080×1080 / 1080×1920 capture

Use OBS Studio (free): add a **Browser Source** pointed at the local file
(or set canvas to 1080×1080 / 1080×1920), then record. This gives an exact
export with no manual cropping.
