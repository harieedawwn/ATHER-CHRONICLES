import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

const rootEl = document.getElementById('root')!;
const animParams = new URLSearchParams(window.location.search);
if (import.meta.env.DEV && animParams.has('vfx')) {
  // dev-only VFX review strip (?vfx=<effect>&color=%23hex)
  import('./game/vfxViewer').then((m) => m.mountVfxViewer(rootEl, animParams.get('vfx') ?? 'impact-heavy', animParams.get('color') ?? '#38bdf8'));
} else if (import.meta.env.DEV && animParams.has('anim')) {
  // dev-only animation review strip (?anim=<moveKey>&fighter=<id>)
  import('./game/animViewer').then((m) => m.mountAnimViewer(rootEl, animParams.get('anim') ?? 'jab1', animParams.get('fighter') ?? 'kenji'));
} else {
  createRoot(rootEl).render(<App />);
}
