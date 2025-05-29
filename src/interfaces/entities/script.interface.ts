// src/interfaces/script.interface.ts
import { TVariableKey } from "./variable.interface";

export interface IScript {
  name: string;
  variables: Record<TVariableKey, string>;
}
