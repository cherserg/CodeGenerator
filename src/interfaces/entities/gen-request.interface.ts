// src/interfaces/entities/gen-request.interface.ts

import { IScript } from "./script.interface";
import { ITemplate } from "./template.interface";
import { IEntity } from "./entity.interface";

export type TExtension = ".ts" | ".json";

export interface IOutput {
  outputPath: string;
  outputExt: TExtension;
  pathOrder?: Array<"entity" | "script">;
  nameOrder?: Array<"entity" | "script" | "template">;
}

export interface IGenerationRequest {
  template: ITemplate;
  entity?: IEntity;
  script: IScript;
  output: IOutput;
}
