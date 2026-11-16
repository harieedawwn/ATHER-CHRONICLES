/**
 * Purpose: Stage specification for Horizon Zero (void_flat), a 620px pure flat astral mirror sanctuary.
 * Exports: VOID_FLAT_STAGE
 * Depends on: ../types
 */

import { StageSpec } from '../types';

export const VOID_FLAT_STAGE: StageSpec = {
  id: 'void_flat',
  name: 'Horizon Zero',
  subtitle: '620px crystal-water sanctuary amidst sunken astral ruins',
  tag: 'Pure Flat · 620px',
  skyTop: '#040711',
  skyMid: '#0b1528',
  skyBottom: '#162947',
  accentColor: '#38bdf8',
  spawnX: [-135, 135],
  platforms: [
    {
      x: 0,
      y: 124,
      width: 620,
      thickness: 44,
      isMain: true,
      style: 'mirror',
    },
  ],
  blastLeft: -640,
  blastRight: 640,
  blastTop: -380,
  blastBottom: 340,
  wallLeft: -310,
  wallRight: 310,
};
