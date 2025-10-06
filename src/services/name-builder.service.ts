import { IOutput } from "../interfaces/entities/gen-request.interface";
import { ITemplate } from "../interfaces/entities/template.interface";

/**
 * Преобразует строку из PascalCase или camelCase в kebab-case.
 * @example
 * toKebabCase("SignOut") // "sign-out"
 * toKebabCase("mySuperVariable") // "my-super-variable"
 */
function toKebabCase(str: string): string {
  if (!str) {
    return "";
  }
  // Находим все заглавные буквы
  return str.replace(/[A-Z]/g, (letter, index) => {
    // Если это первая буква в строке (index === 0) - просто делаем ее строчной.
    // Для всех остальных - добавляем перед ней дефис и делаем строчной.
    return index === 0 ? letter.toLowerCase() : `-${letter.toLowerCase()}`;
  });
}

export class NameBuilderService {
  public generate(
    entityVars: Record<string, string>,
    scriptVars: Record<string, string>,
    template: ITemplate,
    output: IOutput,
    userVariables: Record<string, string> = {}
  ): string {
    const allVars = { ...scriptVars, ...entityVars, ...userVariables };

    // Обрабатываем имя из шаблона: подставляем переменные и конвертируем в kebab-case
    const tplNameRaw = (template.pathName ?? "")
      .trim()
      .replace(/{{\s*(\w+)\s*}}/g, (_match, key) => {
        const value = allVars[key] ?? "";
        return toKebabCase(value);
      });

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

    const ext = template.outputExt || output.outputExt;
    return parts.join(".") + ext;
  }
}
