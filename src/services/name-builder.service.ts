// src/services/name-builder.service.ts

import { IOutput } from "../interfaces/entities/gen-request.interface";
import { ITemplate } from "../interfaces/entities/template.interface";

export class NameBuilderService {
  public generate(
    entityVars: Record<string, string>,
    scriptVars: Record<string, string>,
    template: ITemplate,
    output: IOutput
  ): string {
    // Тримим значение и убираем, если получится пустая строка
    const tplNameRaw = template.pathName?.trim();
    const tplName =
      tplNameRaw && tplNameRaw.length > 0 ? tplNameRaw : undefined;

    const partsMap: Record<string, string | undefined> = {
      entity: entityVars["pathName"],
      script: scriptVars["pathName"] || "script",
      template: tplName,
    };

    const order = output.nameOrder ?? ["entity", "script", "template"];

    // Оставляем только непустые части
    const parts = order
      .map((key) => partsMap[key])
      .filter((part): part is string => Boolean(part));

    // ИЗМЕНЕНО: Убрана привязка к типу TExtension. Теперь используется любое расширение.
    // Это позволяет другим командам генерации также работать с любыми файлами.
    const ext = template.outputExt || output.outputExt;
    return parts.join(".") + ext;
  }
}
