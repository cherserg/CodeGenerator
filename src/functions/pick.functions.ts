// src/functions/pick.functions.ts
import { QuickPickService } from "../services/quick-pick.service";
import type { IEntity, IScript, ITemplate } from "../interfaces";
import { isTemplateApplicable } from "./template-applicability.functions";
import { IProject } from "./project-discovery.functions";

/* ---------- универсальный выбор строк ---------- */
export async function pickStrings(
  values: string[],
  placeHolder: string
): Promise<string[]> {
  return QuickPickService.pickStrings(values, placeHolder);
}

/* ---------- выбор проекта ---------- */
export async function pickProject(
  projects: IProject[],
  placeHolder: string
): Promise<IProject | undefined> {
  if (projects.length === 0) {
    return undefined;
  }
  // Если проект всего один, выбираем его автоматически без диалога
  if (projects.length === 1) {
    return projects[0];
  }

  const pickedNames = await QuickPickService.pickStrings(
    projects.map((p) => p.name),
    placeHolder,
    false // Нам нужен только один выбор
  );

  if (!pickedNames || pickedNames.length === 0) {
    return undefined;
  }

  return projects.find((p) => p.name === pickedNames[0]);
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

/* ---------- выбор сущностей (без опции «Без сущности») ---------- */
export async function pickEntities(
  entities: IEntity[],
  placeHolder: string
): Promise<IEntity[]> {
  const list = entities.map((e) => e.name);
  const pickedNames = await pickStrings(list, placeHolder);
  return pickedNames.map((name) => entities.find((e) => e.name === name)!);
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
  entities: IEntity[],
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
