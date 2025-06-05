// src/utils/pick.utils.ts
import * as vscode from "vscode";
import { IEntity } from "../interfaces/entities/entity.interface";
import { IScript } from "../interfaces/entities/script.interface";
import { ITemplate } from "../interfaces/entities/template.interface";
import { NO_ENTITY_LABEL } from "../interfaces";

/**
 * Выбираем скрипты, отсортированные по алфавиту.
 */
export async function pickScripts(
  scripts: IScript[],
  placeHolder: string
): Promise<IScript[]> {
  const sorted = [...scripts].sort((a, b) =>
    a.name.localeCompare(b.name, "ru", { numeric: true, sensitivity: "base" })
  );
  const items = sorted.map((s) => ({ label: s.name }));
  const picked = await vscode.window.showQuickPick(items, {
    canPickMany: true,
    placeHolder,
  });
  if (!picked?.length) throw new Error("Не выбраны скрипты");
  return picked.map((p) => sorted.find((s) => s.name === p.label)!);
}

/**
 * Выбираем сущности (или «Без сущности»), отсортированные по алфавиту.
 */
export async function pickEntities(
  entities: IEntity[],
  placeHolder: string
): Promise<(IEntity | undefined)[]> {
  const sorted = [...entities].sort((a, b) =>
    a.name.localeCompare(b.name, "ru", { numeric: true, sensitivity: "base" })
  );
  const choices = [
    { label: NO_ENTITY_LABEL, description: "Без сущности" },
    ...sorted.map((e) => ({ label: e.name })),
  ];
  const picked = await vscode.window.showQuickPick(choices, {
    canPickMany: true,
    placeHolder,
  });
  if (!picked?.length) throw new Error("Не выбраны сущности");
  return picked.map((p) =>
    p.label === NO_ENTITY_LABEL
      ? undefined
      : sorted.find((e) => e.name === p.label)!
  );
}

/**
 * Фильтруем и выбираем шаблоны (порядок остаётся как был).
 */
export async function pickTemplates(
  templates: ITemplate[],
  scripts: IScript[],
  entities: (IEntity | undefined)[],
  placeHolder: string
): Promise<ITemplate[]> {
  const filtered = templates.filter(
    (t) =>
      scripts.some((s) => t.applicableScripts.includes(s.name)) &&
      (entities.some((e) => e === undefined) ||
        !t.applicableEntities ||
        t.applicableEntities.length === 0 ||
        entities
          .filter((e) => e)
          .some((e) => t.applicableEntities!.includes(e!.name)))
  );
  const items = filtered.map((t) => ({
    label: t.key,
    description: t.description,
  }));
  const picked = await vscode.window.showQuickPick(items, {
    canPickMany: true,
    placeHolder,
  });
  if (!picked?.length) throw new Error("Не выбраны шаблоны");
  return picked.map((p) => filtered.find((t) => t.key === p.label)!);
}
