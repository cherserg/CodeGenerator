// src/interfaces/entities/entity.interface.ts
import { TVariableKey } from "../entities";

export type IEntity = {
  name: string;
  variables: Record<TVariableKey, string>;
  presets?: string[];
};
