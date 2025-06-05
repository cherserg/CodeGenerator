// src/services/document-generator.service.ts

import { ITemplate } from "../interfaces/entities/template.interface";
import { TemplatePartRepository } from "../repositories/template-part.repository";

export class DocumentGeneratorService {
  constructor(private partRepo: TemplatePartRepository) {}

  public generate(
    template: ITemplate,
    entityVars: Record<string, string>,
    scriptVars: Record<string, string>
  ): string {
    // Берём основной контент шаблона
    let raw = template.content || "";

    // 1) Обработаем «динамические» include’ы вида {{> {{pathName}}-controller-part}},
    //    беря именно entityVars["pathName"]
    raw = raw.replace(
      /{{>\s*{{\s*(\w+)\s*}}\s*-\s*([^\s}]+)\s*}}/g,
      (_match, varName, suffix) => {
        const ent = entityVars[varName];
        return ent ? `{{> ${ent}-${suffix}}}` : "";
      }
    );

    // 2) Подставляем все переменные {{KEY}} — теперь entityVars перезаписывают scriptVars,
    //    чтобы {{pathName}} ссылался на сущность, а не на скрипт
    const vars = { ...scriptVars, ...entityVars };
    raw = raw.replace(/{{\s*(\w+)\s*}}/g, (_match, key) => vars[key] ?? "");

    // 3) Разворачиваем include-подшаблоны {{> partKey}}, пропуская отсутствующие части
    raw = raw.replace(/{{>\s*([^\s}]+)\s*}}/g, (_match, partKey) => {
      const part = this.partRepo.getByKey(partKey);
      return part ? part.content : "";
    });

    // Добавляем шапку во все сгенерированные документы:
    const header =
      "// Этот файл сгенерирован автоматически. Не редактируйте вручную.\n\n";
    return header + raw;
  }
}
