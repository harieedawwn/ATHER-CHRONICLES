// DEV-ONLY VFX review strip: ?vfx=<impact-light|impact-heavy|impact-ground|slash|trail|ink>
// Renders effect frames t=0,1,2,4,7,11,16,22 side by side so timing, layering and colour ramps can be judged.
// Pure rendering with vfxKit: never touches the simulation or its RNG.
import { Fx, Trail, drawArcSweep, drawInkSplat, seedVisualRng } from './vfxKit';

const FRAMES = [0, 1, 2, 4, 7, 11, 16, 22];
const CELL = 240;
const EFFECTS = ['impact-light', 'impact-heavy', 'impact-ground', 'slash', 'trail', 'ink'];

export function mountVfxViewer(root: HTMLElement, effect: string, color = '#38bdf8'): void {
  root.innerHTML = '';
  root.style.cssText = 'background:#06070d;color:#e2e8f0;font:12px monospace;padding:8px;min-height:100vh';
  if (!EFFECTS.includes(effect)) {
    root.textContent = `Unknown effect "${effect}". Try: ${EFFECTS.join(', ')}  (optional &color=%23hex)`;
    return;
  }
  const header = document.createElement('div');
  header.textContent = `vfx: ${effect}  frames ${FRAMES.join(', ')}  (add &color=%23fb923c to test another palette)`;
  header.style.marginBottom = '6px';
  root.appendChild(header);
  const strip = document.createElement('canvas');
  strip.id = 'vfx-strip';
  strip.width = CELL * FRAMES.length;
  strip.height = CELL;
  strip.style.cssText = 'display:block;max-width:none';
  root.appendChild(strip);
  const c = strip.getContext('2d')!;
  c.fillStyle = '#10101c';
  c.fillRect(0, 0, strip.width, strip.height);

  FRAMES.forEach((frame, i) => {
    c.save();
    c.translate(i * CELL, 0);
    c.beginPath();
    c.rect(0, 0, CELL, CELL);
    c.clip();
    c.strokeStyle = '#222238';
    c.strokeRect(0.5, 0.5, CELL - 1, CELL - 1);
    // dummy victim silhouette for scale (character is ~45px tall in game)
    c.strokeStyle = '#3a3a55';
    c.lineWidth = 3;
    c.beginPath();
    c.moveTo(120, 130);
    c.lineTo(120, 165);
    c.moveTo(120, 140);
    c.lineTo(108, 155);
    c.stroke();
    seedVisualRng(11);

    if (effect.startsWith('impact')) {
      const fx = new Fx();
      const heavy = effect === 'impact-heavy';
      const ground = effect === 'impact-ground';
      fx.impact({ x: 120, y: ground ? 170 : 135, dir: 0, power: effect === 'impact-light' ? 0.25 : 0.9, color, ground });
      for (let s = 0; s < frame; s++) fx.update();
      fx.draw(c);
      if (heavy && frame <= 1) {
        c.fillStyle = 'rgba(255,255,255,0.12)';
        c.fillRect(0, 0, CELL, CELL);
      }
    } else if (effect === 'slash') {
      const p = Math.min(1, frame / 14);
      drawArcSweep(c, { x: 70, y: 150, facing: 1, angleStart: -1.2, angleEnd: 0.6, radius: 70, thickness: 5, color }, p);
    } else if (effect === 'trail') {
      const tr = new Trail(12, 9);
      const n = Math.min(9, frame + 1);
      for (let f = 0; f < n; f++) {
        const a = -1.5 + 2.2 * Math.pow(f / 8, 1.4);
        tr.push(70 + Math.cos(a) * 75, 150 + Math.sin(a) * 75);
        tr.step();
      }
      if (frame > 8) for (let k = 0; k < frame - 8; k++) tr.step();
      tr.draw(c, { color, width: 16 });
    } else {
      drawInkSplat(c, 120, 130, 8 + frame * 1.4, 5, color);
    }
    c.fillStyle = '#9fb0ff';
    c.font = '11px monospace';
    c.fillText(`f${frame}`, 6, 14);
    c.restore();
  });
}
