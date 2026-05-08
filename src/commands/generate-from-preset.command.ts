// src/commands/generate-from-preset.command.ts

import * as path from "path";
import * as vscode from "vscode";
import {
  pickEntitiesWithPresets,
  pickPresetKeys,
  pickProject,
} from "../functions/pick.functions";
import { findProjectsInWorkspace } from "../functions/project-discovery.functions";
import { readCodegenConfig } from "../functions/read-config.functions";
import { isTemplateApplicable } from "../functions/template-applicability.functions";
import {
  getWorkspaceRoot,
  showError,
  showInfo,
  showWarning,
} from "../functions/vscode.functions";
import { IEntity } from "../interfaces/entities/entity.interface";
import { IGenerationRequest } from "../interfaces/entities/gen-request.interface";
import { IPreset } from "../interfaces/entities/preset.interface";
import { IScript } from "../interfaces/entities/script.interface";
import { RepositoryLoader } from "../loaders/repository.loader";
import { TemplateManager } from "../managers/template.manager";
import { EntityRepository } from "../repositories/entity.repository";
import { PresetRepository } from "../repositories/preset.repository";
import { ScriptRepository } from "../repositories/script.repository";
import { TemplatePartRepository } from "../repositories/template-part.repository";
import { TemplateRepository } from "../repositories/template.repository";
import { registerCommand } from "./_common";

export function registerGenerateFromPresetCommand(context: unknown) {
  registerCommand(
    context as vscode.ExtensionContext,
    "codegenerator.generateFromPreset",
    async () => {
      const workspaceRoot = getWorkspaceRoot();

      const projects = await findProjectsInWorkspace(workspaceRoot);
      if (projects.length === 0) {
        showWarning("Не найдено ни одного проекта с файлом codegen.json.");
        return;
      }

      const selectedProject = await pickProject(
        projects,
        "Выберите проект для генерации из пресета",
      );

      if (!selectedProject) {
        showWarning("Проект не выбран.");
        return;
      }

      const projectRoot = selectedProject.path;

      const {
        configFolder,
        output: {
          path: globalOutputPath,
          extention: globalOutputExtention,
          pathOrder: globalPathOrder,
          nameOrder: globalNameOrder,
        },
      } = await readCodegenConfig(projectRoot);
      const baseDir = path.join(projectRoot, configFolder);

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
        presetsRepo,
      ).loadAll(baseDir);

      const entitiesWithPresets: IEntity[] = entitiesRepo
        .getAll()
        .filter(
          (ent: IEntity) =>
            Array.isArray(ent.presets) && ent.presets.length > 0,
        );

      const entityObjs = await pickEntitiesWithPresets(
        entitiesWithPresets,
        "Выберите одну или несколько сущностей",
      );

      const uniquePresetLabels: string[] = Array.from(
        new Set(
          entityObjs.reduce<string[]>((acc, ent: IEntity) => {
            if (Array.isArray(ent.presets)) {
              acc.push(...ent.presets);
            }
            return acc;
          }, []),
        ),
      );

      if (uniquePresetLabels.length === 0) {
        showWarning("Нет доступных пресетов для выбранных сущностей.");
        return;
      }

      const selectedPresetKeys = await pickPresetKeys(
        uniquePresetLabels,
        "Выберите пресеты",
      );

      const presetObjs: IPreset[] = selectedPresetKeys
        .map((key) => presetsRepo.getByKey(key))
        .filter((p): p is IPreset => !!p);

      if (presetObjs.length === 0) {
        showWarning("Ни одного найденного пресета не удалось загрузить.");
        return;
      }

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
              `Ни одного доступного скрипта для пресета «${presetObj.key}» не найдено.`,
            );
            continue;
          }

          const templates = allTemplates.filter((tpl) =>
            scriptObjs.some((s) => isTemplateApplicable(tpl, s, entityObj)),
          );

          if (!templates.length) {
            showWarning(
              `Не найдено шаблонов, подходящих под пресет «${presetObj.key}» и сущность «${entityObj.name}».`,
            );
            continue;
          }

          for (const scr of scriptObjs) {
            const applicableTemplates = templates.filter((tpl) =>
              isTemplateApplicable(tpl, scr, entityObj),
            );

            for (const tpl of applicableTemplates) {
              const outputConfig = {
                outputPath: tpl.outputPath
                  ? path.join(projectRoot, tpl.outputPath)
                  : path.join(projectRoot, globalOutputPath),
                outputExt: globalOutputExtention,
                pathOrder: tpl.pathOrder ?? globalPathOrder,
                nameOrder: tpl.nameOrder ?? globalNameOrder,
              };

              const request: IGenerationRequest = {
                template: tpl,
                entity: entityObj,
                script: scr,
                output: outputConfig,
              };

              await manager.generate(request, workspaceRoot);
            }
          }
        }
      }

      showInfo(
        `Генерация завершена для сущностей «${entityObjs
          .map((e) => e.name)
          .join(", ")}» по выбранным пресетам.`,
      );
    },
    (err: unknown) => {
      const message = err instanceof Error ? err.message : String(err);
      showError(`Ошибка: ${message}`);
    },
  );
}
