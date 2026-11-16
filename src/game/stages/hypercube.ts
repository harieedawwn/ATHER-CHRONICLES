/**
 * Purpose: Stage specification for Cyber-Grid 3D (hypercube), a 720px neon megacity overpass with holo-drones.
 * Exports: HYPERCUBE_STAGE
 * Depends on: ../types
 */

import { StageSpec } from '../types';

export const HYPERCUBE_STAGE: StageSpec = {
  id: 'hypercube',
  name: 'Cyber-Grid 3D',
  subtitle: '720px neon megacity overpass with hover-drones & cyber-rooftops',
  tag: 'Wide Cyber · 720px',
  skyTop: '#040312',
  skyMid: '#0e0726',
  skyBottom: '#1e0936',
  accentColor: '#06b6d4',
  spawnX: [-150, 150],
  platforms: [
    { x: 0, y: 126, width: 720, thickness: 40, isMain: true, style: 'holo' },
    {
      x: -155,
      y: 48,
      width: 112,
      thickness: 11,
      isMain: false,
      style: 'holo',
      motion: { axis: 'x', ampX: 26, ampY: 0, speed: 0.028, phase: 0 },
    },
    {
      x: 155,
      y: 48,
      width: 112,
      thickness: 11,
      isMain: false,
      style: 'holo',
      motion: { axis: 'x', ampX: 26, ampY: 0, speed: 0.028, phase: Math.PI },
    },
    { x: -290, y: -8, width: 116, thickness: 12, isMain: false, style: 'holo' },
    { x: 290, y: -8, width: 116, thickness: 12, isMain: false, style: 'holo' },
    {
      x: 0,
      y: -24,
      width: 126,
      thickness: 11,
      isMain: false,
      style: 'holo',
      motion: { axis: 'y', ampX: 0, ampY: 14, speed: 0.036, phase: 1.2 },
    },
  ],
  blastLeft: -720,
  blastRight: 720,
  blastTop: -400,
  blastBottom: 340,
  wallLeft: -360,
  wallRight: 360,
};
