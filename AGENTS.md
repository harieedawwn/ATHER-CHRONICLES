# AGENTS.md - read this first (Gemini, Claude, Codex, anyone)

This is a 2D stick-fighter (React + Vite + TypeScript, canvas renderer at 800x450). Quality bar: polished combat-game feel, not prototype shapes.

## Before you touch animation or effects, READ:
1. `docs/ANIMATION_SKILL.md` - how fighters move (poseKit).
2. `docs/VFX_SKILL.md` - how effects must look (vfxKit). Basic single-layer shapes are NOT acceptable.
Both describe tested code that already exists in `src/game/poseKit.ts` and `src/game/vfxKit.ts`. USE those functions; do not re-invent weaker versions.

## Hard rules
- Never change gameplay: hitboxes, frame data, physics, AI, stats, RNG (`src/game/rng.ts`).
- VFX use only vfxKit's own visual RNG.
- Gate after every batch: `npm run typecheck`, `npm run build`, `npx tsx scripts/regression.ts` (all scenarios must match golden).
- Review visually with `/?anim=<move>&fighter=<id>` and `/?vfx=<effect>`. If you cannot view it, say "not visually verified".
- Work in batches, keep the build green, stop cleanly at the end of a finished batch if budget runs out.
- Vietnamese UI text and Windows paths must keep working; text files UTF-8.
