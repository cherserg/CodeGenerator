import { IScript } from "./script.interface";
import { ITemplate } from "./template.interface";
import { IEntity } from "./entity.interface";

// ИЗМЕНЕНО: Этот тип больше не используется, так как он ограничивал расширения.
// export type TExtension = ".ts" | ".json";

export type IOutput = {
  outputPath: string;
  // ИЗМЕНО: Тип изменен на string, чтобы разрешить любые расширения.
  outputExt: string;
  pathOrder?: Array<"entity" | "script">;
  nameOrder?: Array<"entity" | "script" | "template">;
};

export type IGenerationRequest = {
  template: ITemplate;
  entity?: IEntity;
  script: IScript;
  output: IOutput;
  /**
   * Хранит переменные, полученные от пользователя во время генерации.
   * Например, { operationName: 'SignIn' }
   */
  userVariables?: Record<string, string>;
};
