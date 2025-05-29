// src/services/name-builder.service.ts
import { IOutput } from "../interfaces/entities/gen-request.interface";
import { ITemplate } from "../interfaces/entities/template.interface";

export class NameBuilderService {
  /**
   * Формирует имя файла.
   * Если entity отсутствует — берём только script.pathName.
   */
  public generate(
    entityVars: Record<string, string>,
    scriptVars: Record<string, string>,
    template: ITemplate,
    output: IOutput
  ): string {
    const entityName = entityVars["pathName"];
    const scriptName = scriptVars["pathName"] || "script";
    const ext = template.outputExt || output.outputExt;

    return entityName
      ? `${entityName}.${scriptName}${ext}`
      : `${scriptName}${ext}`;
  }
}
