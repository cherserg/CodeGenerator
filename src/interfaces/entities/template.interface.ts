// src/interfaces/entities/template.interface.ts

import { TExtension } from "./gen-request.interface";

export interface TemplatePart {
  key: string;
  content: string;
}

export interface ITemplate {
  key: string;
  content: string;
  description?: string;
  applicableScripts?: string[];
  applicableEntities?: string[];
  nonApplicableScripts?: string[];
  nonApplicableEntities?: string[];
  outputExt: TExtension;
  outputPath?: string;
  pathOrder?: Array<"entity" | "script">;
}
