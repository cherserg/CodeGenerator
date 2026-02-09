// src/services/document-generator.service.ts

import { ITemplate } from "../interfaces/entities/template.interface";
import { TemplatePartRepository } from "../repositories/template-part.repository";

// src/services/document-generator.service.ts

export class DocumentGeneratorService {
  constructor(private partRepo: TemplatePartRepository) {}

  public generate(
    template: ITemplate,
    entityVars: Record<string, string>,
    scriptVars: Record<string, string>,
    userVariables: Record<string, string> = {},
  ): string {
    let content = template.content || "";
    // Собираем все переменные в один объект
    const allVars = { ...scriptVars, ...entityVars, ...userVariables };

    // ШАГ 1: Подставляем простые переменные везде (включая внутренности {{> ...}})
    // Это превратит {{> {{entitySmallName}}.{{operationName}}.req}}
    // в {{> auth.google.req}}
    content = content.replace(/{{\s*(\w+)\s*}}/g, (_match, key) => {
      return allVars[key] !== undefined ? allVars[key] : _match;
    });

    // ШАГ 2: Теперь разворачиваем инклуды, которые уже содержат готовые ключи
    content = content.replace(/{{>\s*([^\s}]+)\s*}}/g, (_match, partKey) => {
      const part = this.partRepo.getByKey(partKey);
      if (part) {
        return part.content;
      }
      // Если часть не найдена, оставляем заметку в коде для отладки
      return `/* TemplatePart not found: ${partKey} */`;
    });

    return content;
  }
}
