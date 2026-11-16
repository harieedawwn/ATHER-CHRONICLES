/**
 * Purpose: Stage specification for Möbius Continuum (tesseract), a 430px low-gravity spatial warp loop arena.
 * Exports: TESSERACT_STAGE
 * Depends on: ../types
 */

import { StageSpec } from '../types';

export const TESSERACT_STAGE: StageSpec = {
  id: 'tesseract',
  name: 'Möbius Continuum',
  subtitle: 'Compact 430px clockwork cathedral with edge warp-portals & 0.78× low-G',
  tag: 'Compact Loop · Low-G',
  skyTop: '#050410',
  skyMid: '#150e30',
  skyBottom: '#2b134d',
  accentColor: '#c084fc',
  spawnX: [-105, 105],
  gravityMult: 0.78,
  wrapHorizontal: true,
  wrapEdgeX: 285,
  platforms: [
    { x: 0, y: 126, width: 430, thickness: 44, isMain: true, style: 'gold' },
    {
      x: -135,
      y: 28,
      width: 106,
      thickness: 11,
      isMain: false,
      style: 'gold',
      motion: { axis: 'orbit', ampX: 20, ampY: 16, speed: 0.024, phase: 0 },
    },
    {
      x: 135,
      y: 28,
      width: 106,
      thickness: 11,
      isMain: false,
      style: 'gold',
      motion: { axis: 'orbit', ampX: -20, ampY: 16, speed: 0.024, phase: Math.PI },
    },
  ],
  jumpPads: [{ x: 0, y: 126, width: 42, boostVy: -12.0, color: '#e879f9' }],
  blastLeft: -540,
  blastRight: 540,
  blastTop: -400,
  blastBottom: 340,
  wallLeft: -280,
  wallRight: 280,
};
