// src/commands/generateFromPreset.ts
import * as path from "path";
import * as vscode from "vscode";

import { registerCommand } from "./_common";
import { TemplateRepository } from "../repositories/template.repository";
import { TemplatePartRepository } from "../repositories/template-part.repository";
import { ScriptRepository } from "../repositories/script.repository";
import { EntityRepository } from "../repositories/entity.repository";
import { PresetRepository } from "../repositories/preset.repository";
import { RepositoryLoader } from "../loaders/repository.loader";
import { TemplateManager } from "../managers/template.manager";

import { IGenerationRequest } from "../interfaces/entities/gen-request.interface";
import { IEntity } from "../interfaces/entities/entity.interface";
import { IScript } from "../interfaces/entities/script.interface";
import { IPreset } from "../interfaces/entities/preset.interface";
import {
  getWorkspaceRoot,
  showError,
  showInfo,
  showWarning,
} from "../utils/vscode.utils";
import { readCodegenConfig } from "../utils/read-config.util";
import { isTemplateApplicable } from "../utils/template-applicability.util";

export function registerGenerateFromPresetCommand(context: any) {
  registerCommand(
    context,
    "codegenerator.generateFromPreset",
    async () => {
      const root = getWorkspaceRoot();
      const {
        configFolder,
        outputPath: globalOutputPath,
        outputExt,
        pathOrder: globalPathOrder,
      } = await readCodegenConfig(root);
      const baseDir = path.join(root, configFolder);

      const tplRepo = new TemplateRepository();
      const partRepo = new TemplatePartRepository();
      const scriptsRepo = new ScriptRepository();
      const entitiesRepo = new EntityRepository();
      const presetsRepo = new PresetRepository();

      await new RepositoryLoader(
        tplRepo,
        partRepo,
        scriptsRepo,
        entitiesRepo,
        presetsRepo
      ).loadAll(baseDir);

      /* ---------- выбор сущностей с пресетами ---------- */
      const entityChoices: vscode.QuickPickItem[] = entitiesRepo
        .getAll()
        .filter(
          (e: IEntity) => Array.isArray(e.presets) && e.presets.length > 0
        )
        .map((e: IEntity) => ({ label: e.name }));
      const entityPicks = await vscode.window.showQuickPick(entityChoices, {
        canPickMany: true,
        placeHolder: "Выберите одну или несколько сущностей",
      });
      if (!entityPicks || entityPicks.length === 0) {
        throw new Error("Сущности не выбраны");
      }
      const entityObjs: IEntity[] = entityPicks
        .map((p) => entitiesRepo.getByKey(p.label))
        .filter((e): e is IEntity => e !== undefined);

      /* ---------- объединяем все пресеты выбранных сущностей ---------- */
      const allPresetLabels: string[] = entityObjs.reduce<string[]>(
        (acc, e) => {
          if (Array.isArray(e.presets)) {
            return acc.concat(e.presets);
          }
          return acc;
        },
        []
      );
      const uniquePresetLabels: string[] = Array.from(new Set(allPresetLabels));
      if (uniquePresetLabels.length === 0) {
        showWarning("Нет доступных пресетов для выбранных сущностей.");
        return;
      }

      /* ---------- выбор пресетов ---------- */
      const presetItems: vscode.QuickPickItem[] = uniquePresetLabels.map(
        (presetKey: string) => ({ label: presetKey })
      );
      const presetPicks = await vscode.window.showQuickPick(presetItems, {
        canPickMany: true,
        placeHolder: "Выберите пресеты",
      });
      if (!presetPicks || presetPicks.length === 0) {
        throw new Error("Пресеты не выбраны");
      }
      const selectedPresetKeys: string[] = presetPicks.map((p) => p.label);

      const presetObjs: IPreset[] = selectedPresetKeys
        .map((key: string) => presetsRepo.getByKey(key))
        .filter((p): p is IPreset => p !== undefined);
      if (presetObjs.length === 0) {
        showWarning("Ни одного найденного пресета не удалось загрузить.");
        return;
      }

      /* ---------- генерация для каждой комбинации сущности + пресет ---------- */
      const manager = new TemplateManager(partRepo);
      const allTemplates = tplRepo.getAll();

      for (const entityObj of entityObjs) {
        for (const presetObj of presetObjs) {
          if (
            !entityObj.presets ||
            !entityObj.presets.includes(presetObj.key)
          ) {
            // Этот пресет не относится к этой сущности, пропускаем
            continue;
          }

          /* ---------- скрипты из пресета ---------- */
          const scriptObjs: IScript[] = presetObj.scripts
            .map((scriptName: string) => scriptsRepo.getByKey(scriptName))
            .filter((s): s is IScript => s !== undefined);

          if (scriptObjs.length === 0) {
            showWarning(
              `Ни одного доступного скрипта для пресета «${presetObj.key}» не найдено.`
            );
            continue;
          }

          /* ---------- подходящие шаблоны ---------- */
          const templates = allTemplates.filter((tpl) =>
            scriptObjs.some((s) => isTemplateApplicable(tpl, s, entityObj))
          );
          if (templates.length === 0) {
            showWarning(
              `Не найдено шаблонов, подходящих под пресет «${presetObj.key}» и сущность «${entityObj.name}».`
            );
            continue;
          }

          /* ---------- генерация ---------- */
          for (const scr of scriptObjs) {
            const applicableTemplates = templates.filter((tpl) =>
              isTemplateApplicable(tpl, scr, entityObj)
            );

            for (const tpl of applicableTemplates) {
              const outputConfig = {
                outputPath: tpl.outputPath
                  ? path.join(root, tpl.outputPath)
                  : path.join(root, globalOutputPath),
                outputExt,
                pathOrder: tpl.pathOrder ?? globalPathOrder,
              };

              const request: IGenerationRequest = {
                template: tpl,
                entity: entityObj,
                script: scr,
                output: outputConfig,
              };

              await manager.generate(request);
            }
          }
        }
      }

      const entityNames = entityObjs.map((e) => e.name).join(", ");
      const presetNames = presetObjs.map((p) => p.key).join(", ");
      showInfo(
        `Генерация по пресетам «${presetNames}» для сущностей «${entityNames}» завершена`
      );
    },
    (err) => showError(`Ошибка: ${err.message}`)
  );
}
