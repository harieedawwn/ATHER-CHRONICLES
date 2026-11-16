/**
 * Purpose: Stage specification for Crimson Torii (torii), a classic balanced 560px tri-platform shrine.
 * Exports: TORII_STAGE
 * Depends on: ../types
 */

import { StageSpec } from '../types';

export const TORII_STAGE: StageSpec = {
  id: 'torii',
  name: 'Crimson Torii',
  subtitle: 'Blood-moon sakura shrine with tri-platform wooden eaves',
  tag: 'Tri-Platform · 560px',
  skyTop: '#090714',
  skyMid: '#1f102b',
  skyBottom: '#451531',
  accentColor: '#f43f5e',
  spawnX: [-125, 125],
  platforms: [
    { x: 0, y: 124, width: 560, thickness: 165, isMain: true, style: 'stone' },
    { x: -165, y: 46, width: 122, thickness: 12, isMain: false, style: 'wood' },
    { x: 165, y: 46, width: 122, thickness: 12, isMain: false, style: 'wood' },
    { x: 0, y: -24, width: 132, thickness: 12, isMain: false, style: 'wood' },
  ],
  blastLeft: -600,
  blastRight: 600,
  blastTop: -390,
  blastBottom: 340,
  wallLeft: -280,
  wallRight: 280,
};
