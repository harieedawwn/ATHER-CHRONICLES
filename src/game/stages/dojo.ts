/**
 * Purpose: Stage specification for Cloud Pagoda (dojo), a vertical multi-tier sky temple with chain elevators.
 * Exports: DOJO_STAGE
 * Depends on: ../types
 */

import { StageSpec } from '../types';

export const DOJO_STAGE: StageSpec = {
  id: 'dojo',
  name: 'Cloud Pagoda',
  subtitle: '5-story sky temple with chain-driven elevators & high belfry decks',
  tag: 'Vertical Tower · Elevators',
  skyTop: '#060d1a',
  skyMid: '#102238',
  skyBottom: '#264563',
  accentColor: '#f59e0b',
  spawnX: [-130, 130],
  platforms: [
    { x: 0, y: 130, width: 550, thickness: 165, isMain: true, style: 'wood' },
    {
      x: -195,
      y: 42,
      width: 112,
      thickness: 12,
      isMain: false,
      style: 'wood',
      motion: { axis: 'y', ampX: 0, ampY: 38, speed: 0.026, phase: 0 },
    },
    {
      x: 195,
      y: 42,
      width: 112,
      thickness: 12,
      isMain: false,
      style: 'wood',
      motion: { axis: 'y', ampX: 0, ampY: 38, speed: 0.026, phase: Math.PI },
    },
    { x: 0, y: -22, width: 136, thickness: 12, isMain: false, style: 'gold' },
    { x: -130, y: -88, width: 96, thickness: 11, isMain: false, style: 'gold' },
    { x: 130, y: -88, width: 96, thickness: 11, isMain: false, style: 'gold' },
  ],
  blastLeft: -600,
  blastRight: 600,
  blastTop: -460,
  blastBottom: 340,
  wallLeft: -275,
  wallRight: 275,
};
