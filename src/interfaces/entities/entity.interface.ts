// src/interfaces/entities/entity.interface.ts
import { TVariableKey } from "../entities";

export interface IEntity {
  name: string;
  variables: Record<TVariableKey, string>;
  presets?: string[];
}
