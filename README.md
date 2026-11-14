# Morti: Jamón Quest

A 2D cartoon platform adventure inside a cozy house. Built with Phaser 3.90, TypeScript, and Vite. Original cat photos remain in the parent folder.

## Play now

Open **`index.html`** in a desktop browser. It is a single self-contained file with all styling, JavaScript, Phaser, and artwork embedded. It can be copied to any folder and opened without a server or network connection. `dist/index.html` is an identical copy.

- Move: **A/D** or **left/right arrows**.
- Jump: **Space**, **Up**, or **W**. Mobile browsers have touch buttons.
- Pause/resume: **P**, **Escape**, or the toolbar.
- Collect jamón for 10 points per slice. Reach the feast for a 100-point bonus.
- Canelo constantly patrols once in each zone; his back is a moving platform that carries Morti. Chris leaves floor puddles that flip Morti upside down and launch him sideways for one second. Puddles do not affect cats on furniture above them.
- Bomboniel appears only in the final kitchen section. Bait her from the floor strictly between the inner stool edges, then jump her fast dash. Perching on a stool or waiting outside the stools will not trigger a charge. Getting hit invalidates that dash's crash point, including contact during invulnerability. Evade three dashes into the stools, then jump onto the feast table.
- Falls return you to a checkpoint without losing collected jamón. A fall during the finale resets Bomboniel's crash count. No lives or timer.
- Best completed score is stored locally when browser storage is available.

## Develop

With network access:

```sh
npm install
npm run dev
```

Open the local URL printed by Vite. `vite.config.ts` uses the editable `src/page.html` template for development and builds, while the root `index.html` remains directly playable. Standard production build: `npm run build`.

The alternate `npm run build:portable` type-checks the same sources, embeds the compiled classic script, stylesheet, artwork, and pinned vendored Phaser runtime into both root and dist entrypoints so either opens directly from disk. It requires TypeScript but does not require Vite or npm network access once TypeScript is installed.

## Validate

```sh
npm test
npm run build:portable
npm run test:package
npm run test:runtime
npm run test:browser
```

Browser QA requires Playwright and an installed Chromium-family browser. Set `MORTI_BROWSER` to its executable path. `MORTI_PLAYWRIGHT` optionally selects an existing local Playwright installation. Screenshots go to `artifacts/`.

Completed here: TypeScript checks, scoring/checkpoint/room/layout rule checks, eighteen encounter/puddle/patrol checks, and standalone-package checks that confirm CSS parses/applies and all inline scripts compile. The real Phaser Canvas renderer also ran under a simulated DOM with native canvas: movement, pickup overlaps, pause, continuous traversal of the furniture route, all three stool crashes, feast completion, and restart passed without uncaught runtime errors. Actual game frames are in `artifacts/runtime-*.png`. This is not a browser screenshot or full-page visual test. Chromium startup remains blocked by sandbox socket restrictions (`Operation not permitted`), so browser and mobile visual checks remain outstanding. The runtime check uses jsdom and @napi-rs/canvas; `MORTI_JSDOM` and `MORTI_CANVAS` can select local installations.

## Artwork and animation

`public/assets/characters.png` is the original transparent four-character atlas, generated using the supplied cat photos. `public/assets/room.png` is the original living room background; `public/assets/hallway.png` and `public/assets/kitchen.png` are matching generated backgrounds for the other zones. See `ASSET-PROMPTS.md` for prompts and identity details. The runtime trims each character and produces six-frame squash/stretch animation atlases. Running, jumping, eating, slipping, windup, impact, and dizzy states add procedural motion; these are not individually hand-drawn frame sequences.

Furniture and visible descending stair treads are drawn in code so platform art aligns with collision geometry. Static artwork and pickups use explicit camera culling; small character atlases, static jamón pickups, pooled score feedback, and throttled progress drawing reduce frame work. Gameplay message popups have been removed. UI text is rendered separately. Bomboniel's two collars and green-grey eyes are intentional corrections to the supplied photo.

## Hosting

`.openai/hosting.json` retains the registered private Sites project. No deployment succeeded: Git source synchronization was blocked by DNS/network restrictions. Resume the Sites source-helper workflow using this existing project ID; do not create another Site. The deployment directory is `dist`.

Phaser is MIT licensed; its license is included in `public/vendor/PHASER-LICENSE.txt` and the build.

## GitHub Pages

This is a fully static game. The generated root `index.html` contains the code, styling and images; no backend, Node process, Vercel service or GitHub build is required. Personal best scores stay in browser storage.

Upload the generated `index.html`, `.nojekyll`, and `public/vendor/PHASER-LICENSE.txt` to the root of a GitHub repository. Under **Settings → Pages**, select **Deploy from a branch**, then **main** and **/ (root)**. GitHub will provide the published URL. Replacing `index.html` with a newer portable build updates the game. Do not upload the editable `src/page.html` as the entrypoint.

GitHub documentation: https://docs.github.com/en/pages/getting-started-with-github-pages/creating-a-github-pages-site
# game
