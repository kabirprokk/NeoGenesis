# dev-play — my hands and eyes inside NeoGenesis

A real browser bridge (Chrome + `playwright-core`, no downloads) so an AI
can genuinely playtest: see screenshots, press keys, type into the real UI,
read console errors. No engine cheats — the same inputs a human has.

## Setup (once)

```powershell
cd dev-play; npm install   # playwright-core only; drives installed Chrome
```

## Run

```powershell
# terminal 1: the game
npm run dev --workspace=@neogenesis/frontend   # http://localhost:5173/
# terminal 2: play it
cd dev-play
node drive.mjs enter snap:game errors
node drive.mjs enter w:4000 space snap:walk errors
node drive.mjs enter key:Backquote type:whereami enterkey snap:term errors
node drive.mjs enter "neorun:melt a lead cube in lava" snap:exp errors
node drive.mjs enter canvas key:B snap:brain errors
```

## Mini-language

`enter` (click Enter the plane) · `wait:MS` · `snap:NAME` → `shots/*.png`
(read them with the Read tool to SEE) · `w:MS a:MS s:MS d:MS` (hold keys) ·
`space` · `key:CODE` (KeyX, KeyB, KeyG, Backquote…) · `canvas` (focus game) ·
`look:DX,DY` (drag-look) · `type:TEXT` · `enterkey` · `neorun:TEXT` (Neo bar +
Enter) · `scan` (NaN geometry hunt via dev-only `window.__neoScene`) ·
`errors`.

## Bugs it has caught

- Star-field sign bug → NaN vertices (`shared/src/astro.ts`).
- Terminal backtick self-pollution (`App.tsx` preventDefault).
- Junk verdicts for unknown input (terminal default now guides).
- HUD/NeoBar overlap, empty opening frame, cloud sprite edges, ground
  confetti + tiling seams.
