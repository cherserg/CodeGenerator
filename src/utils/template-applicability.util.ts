// src/utils/template-applicability.util.ts
import { ITemplate } from "../interfaces/entities/template.interface";
import { IScript } from "../interfaces/entities/script.interface";
import { IEntity } from "../interfaces/entities/entity.interface";

/**
 * Проверяет, применим ли шаблон к паре (script, entity).
 *
 * Правила для каждой размерности (скрипт / сущность):
 * 1. Нет `applicable*` и `nonApplicable*` → true
 * 2. Есть только `applicable*`            → объект обязан присутствовать в `applicable*`
 * 3. Есть только `nonApplicable*`         → объект **не** должен присутствовать в `nonApplicable*`
 * 4. Заданы оба                           → учитываем **только** `applicable*`
 *
 * Важно: если у шаблона указан `applicableEntities`, но entity == undefined
 * (т.е. «Без сущности»), то шаблон НЕ считается применимым.
 */
export function isTemplateApplicable(
  template: ITemplate,
  script: IScript,
  entity?: IEntity
): boolean {
  /* ---------- проверка скрипта ---------- */
  const hasApplScripts =
    Array.isArray(template.applicableScripts) &&
    template.applicableScripts.length > 0;
  const hasNonApplScripts =
    Array.isArray(template.nonApplicableScripts) &&
    template.nonApplicableScripts.length > 0;

  let scriptOk = true;
  if (hasApplScripts) {
    scriptOk = template.applicableScripts!.includes(script.name);
  } else if (hasNonApplScripts) {
    scriptOk = !template.nonApplicableScripts!.includes(script.name);
  }

  /* ---------- проверка сущности ---------- */
  const hasApplEntities =
    Array.isArray(template.applicableEntities) &&
    template.applicableEntities.length > 0;
  const hasNonApplEntities =
    Array.isArray(template.nonApplicableEntities) &&
    template.nonApplicableEntities.length > 0;

  let entityOk = true;

  if (entity) {
    if (hasApplEntities) {
      entityOk = template.applicableEntities!.includes(entity.name);
    } else if (hasNonApplEntities) {
      entityOk = !template.nonApplicableEntities!.includes(entity.name);
    }
  } else {
    // entity == undefined («Без сущности»)
    // Если у шаблона задан applicableEntities, то без сущности он не применим
    if (hasApplEntities) entityOk = false;
    // nonApplicableEntities для undefined сущности не проверяем — это нормально
  }

  return scriptOk && entityOk;
}
