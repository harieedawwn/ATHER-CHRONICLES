// DEV-ONLY animation review strip: ?anim=<moveKey>&fighter=<id>
// Renders 12 evenly spaced frames (idle -> impact -> recovery) of one move on a single canvas.
// Pure rendering: it never steps the simulation and never touches gameplay state.
import { createFighter } from './engine';
import { HDPixelRenderer, RENDER_H, RENDER_W } from './renderer';
import { STAGES } from './stages';
import { FIGHTERS } from './fighters';
import type { FighterId, MoveKey } from './types';

const FRAMES = 12;
const CELL = 220;
const LABEL_H = 34;

export function mountAnimViewer(root: HTMLElement, moveKey: string, fighterId: string): void {
  const spec = FIGHTERS[fighterId as FighterId];
  const stage = STAGES.torii;
  root.innerHTML = '';
  root.style.cssText = 'background:#06070d;color:#e2e8f0;font:12px monospace;padding:8px;min-height:100vh';
  if (!spec) {
    root.textContent = `Unknown fighter "${fighterId}". Try: ${Object.keys(FIGHTERS).join(', ')}`;
    return;
  }
  const move = spec.moves[moveKey as MoveKey];
  if (!move) {
    root.textContent = `Unknown move "${moveKey}" for ${fighterId}. Try: ${Object.keys(spec.moves).join(', ')}`;
    return;
  }
  const total = move.startup + move.active + move.recovery;
  const header = document.createElement('div');
  header.textContent = `${fighterId} / ${moveKey}  startup ${move.startup}  active ${move.active}  recovery ${move.recovery}  (total ${total}f)`;
  header.style.marginBottom = '6px';
  root.appendChild(header);

  const strip = document.createElement('canvas');
  strip.id = 'anim-strip';
  strip.width = CELL * FRAMES;
  strip.height = CELL + LABEL_H;
  strip.style.cssText = 'display:block;image-rendering:pixelated;max-width:none';
  root.appendChild(strip);
  const sctx = strip.getContext('2d')!;
  sctx.fillStyle = '#06070d';
  sctx.fillRect(0, 0, strip.width, strip.height);

  const target = document.createElement('canvas');
  target.width = RENDER_W;
  target.height = RENDER_H;
  const groundY = stage.platforms[0].y - 18;
  const aerial = moveKey.endsWith('air');

  for (let i = 0; i < FRAMES; i++) {
    const frame = Math.min(total - 1, Math.round((i * (total - 1)) / (FRAMES - 1)));
    // fresh renderer per cell: no pose smoothing history leaks between cells
    const renderer = new HDPixelRenderer();
    const f1 = createFighter(0, fighterId as FighterId, 0, aerial ? groundY - 30 : groundY, 1, 3);
    const f2 = createFighter(1, fighterId as FighterId, 900, groundY, -1, 3); // dummy far off-screen
    f1.grounded = !aerial;
    f2.grounded = true;
    f1.invulnFrames = 0;
    f2.invulnFrames = 0;
    f1.action = 'attack';
    f1.currentMove = move;
    f1.actionFrame = frame;
    for (const f of [f1, f2]) {
      for (let k = 0; k < f.scarf.length; k++) {
        f.scarf[k].x = f.x - f.facing * (2 + k * 4.2);
        f.scarf[k].y = f.y - 18;
      }
    }
    renderer.render(target, {
      stage, fighters: [f1, f2], projectiles: [], riftSeals: [], stasisFields: [], portals: [],
      delayedSlashes: [], afterimages: [], slashArcs: [], shockwaves: [], particles: [], callouts: [],
      camX: 8, camY: groundY - 12, camZoom: 3.4, shakeX: 0, shakeY: 0,
      impactFrames: 0, impactInverted: false, showHitboxes: false, tick: 1,
    });
    const crop = 300;
    sctx.drawImage(target, (RENDER_W - crop) / 2, (RENDER_H - crop) / 2, crop, crop, i * CELL, LABEL_H, CELL, CELL);
    const phase = frame < move.startup ? 'startup' : frame < move.startup + move.active ? 'ACTIVE' : 'recovery';
    sctx.fillStyle = phase === 'ACTIVE' ? '#facc15' : '#94a3b8';
    sctx.font = '14px monospace';
    sctx.fillText(`f${frame} ${phase}`, i * CELL + 8, 22);
    sctx.strokeStyle = '#1e293b';
    sctx.strokeRect(i * CELL + 0.5, 0.5, CELL - 1, CELL + LABEL_H - 1);
  }
}
