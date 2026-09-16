// streamBus — the live language-assembly feed for the brain visualizer.
// NeoBar writes here while replies stream out token-by-token; BrainPanel
// reads on its own interval. No React state crosses components, so the game
// loop never re-renders for this.
export interface StreamToken { text: string; p: number }
export const streamBus: {
  active: boolean; token: string; assembled: string; tps: number;
  candidates: StreamToken[]; letters: string;
} = { active: false, token: "", assembled: "", tps: 0, candidates: [], letters: "" };
