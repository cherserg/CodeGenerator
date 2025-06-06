// src/utils/pick.utils.ts
import { QuickPickService } from "./quick-pick.service";
import { IEntity } from "../interfaces/entities/entity.interface";
import { IScript } from "../interfaces/entities/script.interface";
import { ITemplate } from "../interfaces/entities/template.interface";
import { NO_ENTITY_LABEL } from "../interfaces";
import { isTemplateApplicable } from "./template-applicability.util";

/* ---------- универсальный выбор строк ---------- */
export async function pickStrings(
  values: string[],
  placeHolder: string
): Promise<string[]> {
  return QuickPickService.pickStrings(values, placeHolder);
}

/* ---------- выбор скриптов ---------- */
export async function pickScripts(
  scripts: IScript[],
  placeHolder: string
): Promise<IScript[]> {
  const pickedNames = await pickStrings(
    scripts.map((s) => s.name),
    placeHolder
  );
  return pickedNames.map((name) => scripts.find((s) => s.name === name)!);
}

/* ---------- выбор сущностей (с опцией «Без сущности») ---------- */
export async function pickEntities(
  entities: IEntity[],
  placeHolder: string
): Promise<(IEntity | undefined)[]> {
  const list = [NO_ENTITY_LABEL, ...entities.map((e) => e.name)];
  const picked = await pickStrings(list, placeHolder);

  return picked.map((name) =>
    name === NO_ENTITY_LABEL
      ? undefined
      : entities.find((e) => e.name === name)!
  );
}

/* ---------- выбор сущностей ТОЛЬКО из переданного списка (без «Без сущности») ---------- */
export async function pickEntitiesWithPresets(
  entities: IEntity[],
  placeHolder: string
): Promise<IEntity[]> {
  const pickedNames = await pickStrings(
    entities.map((e) => e.name),
    placeHolder
  );
  return pickedNames.map((name) => entities.find((e) => e.name === name)!);
}

/* ---------- выбор шаблонов ---------- */
export async function pickTemplates(
  templates: ITemplate[],
  scripts: IScript[],
  entities: (IEntity | undefined)[],
  placeHolder: string
): Promise<ITemplate[]> {
  const filtered = templates.filter((tpl) =>
    scripts.some((s) => entities.some((e) => isTemplateApplicable(tpl, s, e)))
  );

  const pickedKeys = await pickStrings(
    filtered.map((t) => t.key),
    placeHolder
  );

  return pickedKeys.map((k) => filtered.find((t) => t.key === k)!);
}

/* ---------- выбор ключей пресетов ---------- */
export async function pickPresetKeys(
  presetKeys: string[],
  placeHolder: string
): Promise<string[]> {
  return pickStrings(presetKeys, placeHolder);
}
