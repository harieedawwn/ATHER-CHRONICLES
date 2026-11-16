/**
 * Purpose: Stage registry mapping StageId to StageSpec, ordered STAGE_LIST, and platform solver re-exports.
 * Exports: ResolvedPlatform, resolvePlatformAtTick, STAGES, STAGE_LIST
 * Depends on: ../types, ./resolvePlatform, ./voidFlat, ./torii, ./dojo, ./monolith, ./coliseum, ./hypercube, ./tesseract, ./train
 */

import { StageId, StageSpec } from '../types';
import { COLISEUM_STAGE } from './coliseum';
import { DOJO_STAGE } from './dojo';
import { HYPERCUBE_STAGE } from './hypercube';
import { MONOLITH_STAGE } from './monolith';
import { ResolvedPlatform, resolvePlatformAtTick } from './resolvePlatform';
import { TESSERACT_STAGE } from './tesseract';
import { TORII_STAGE } from './torii';
import { TRAIN_STAGE } from './train';
import { VOID_FLAT_STAGE } from './voidFlat';

export type { ResolvedPlatform };
export { resolvePlatformAtTick };

export const STAGES: Record<StageId, StageSpec> = {
  void_flat: VOID_FLAT_STAGE,
  torii: TORII_STAGE,
  dojo: DOJO_STAGE,
  monolith: MONOLITH_STAGE,
  coliseum: COLISEUM_STAGE,
  hypercube: HYPERCUBE_STAGE,
  tesseract: TESSERACT_STAGE,
  train: TRAIN_STAGE,
};

export const STAGE_LIST: StageSpec[] = [
  STAGES.void_flat,
  STAGES.torii,
  STAGES.dojo,
  STAGES.monolith,
  STAGES.coliseum,
  STAGES.hypercube,
  STAGES.tesseract,
  STAGES.train,
];
