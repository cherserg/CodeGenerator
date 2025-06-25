// src/commands/generateFromPreset.ts

import * as path from "path";
import { registerCommand } from "./_common";
import { pickEntitiesWithPresets, pickPresetKeys } from "../utils/pick.utils";
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
        nameOrder: globalNameOrder,
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
      const entitiesWithPresets: IEntity[] = entitiesRepo
        .getAll()
        .filter(
          (ent: IEntity) => Array.isArray(ent.presets) && ent.presets.length > 0
        );

      const entityObjs = await pickEntitiesWithPresets(
        entitiesWithPresets,
        "Выберите одну или несколько сущностей"
      );

      /* ---------- объединяем все пресеты выбранных сущностей ---------- */
      const uniquePresetLabels: string[] = Array.from(
        new Set(
          entityObjs.reduce<string[]>((acc, ent: IEntity) => {
            if (Array.isArray(ent.presets)) {
              acc.push(...ent.presets);
            }
            return acc;
          }, [])
        )
      );

      if (uniquePresetLabels.length === 0) {
        showWarning("Нет доступных пресетов для выбранных сущностей.");
        return;
      }

      /* ---------- выбор пресетов ---------- */
      const selectedPresetKeys = await pickPresetKeys(
        uniquePresetLabels,
        "Выберите пресеты"
      );

      const presetObjs: IPreset[] = selectedPresetKeys
        .map((key) => presetsRepo.getByKey(key))
        .filter((p): p is IPreset => !!p);

      if (presetObjs.length === 0) {
        showWarning("Ни одного найденного пресета не удалось загрузить.");
        return;
      }

      /* ---------- генерация ---------- */
      const manager = new TemplateManager(partRepo);
      const allTemplates = tplRepo.getAll();

      for (const entityObj of entityObjs) {
        for (const presetObj of presetObjs) {
          if (!entityObj.presets?.includes(presetObj.key)) continue;

          const scriptObjs: IScript[] = presetObj.scripts
            .map((name) => scriptsRepo.getByKey(name))
            .filter((s): s is IScript => !!s);

          if (!scriptObjs.length) {
            showWarning(
              `Ни одного доступного скрипта для пресета «${presetObj.key}» не найдено.`
            );
            continue;
          }

          const templates = allTemplates.filter((tpl) =>
            scriptObjs.some((s) => isTemplateApplicable(tpl, s, entityObj))
          );

          if (!templates.length) {
            showWarning(
              `Не найдено шаблонов, подходящих под пресет «${presetObj.key}» и сущность «${entityObj.name}».`
            );
            continue;
          }

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
                nameOrder: tpl.nameOrder ?? globalNameOrder,
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

      showInfo(
        `Генерация завершена для сущностей «${entityObjs
          .map((e) => e.name)
          .join(", ")}» по выбранным пресетам.`
      );
    },
    (err) => showError(`Ошибка: ${err.message}`)
  );
}
