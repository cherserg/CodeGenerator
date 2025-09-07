// src/interfaces/entities/script.interface.ts
import { TVariableKey } from "./variable.interface";

export type IScript = {
  name: string;
  variables: Record<TVariableKey, string>;
};
