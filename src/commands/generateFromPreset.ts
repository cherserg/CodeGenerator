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

      /* ---------- выбор сущности с пресетом ---------- */
      const entityPick = await vscode.window.showQuickPick(
        entitiesRepo
          .getAll()
          .filter((e) => e.presets?.length)
          .map((e) => ({ label: e.name })),
        { placeHolder: "Выберите сущность" }
      );
      if (!entityPick) throw new Error("Сущность не выбрана");
      const entityObj = entitiesRepo.getByKey(entityPick.label)!;

      /* ---------- выбор пресета ---------- */
      const presetPick = await vscode.window.showQuickPick(
        entityObj.presets!.map((p) => ({ label: p })),
        { placeHolder: "Выберите пресет" }
      );
      if (!presetPick) throw new Error("Пресет не выбран");

      const presetObj = presetsRepo.getByKey(presetPick.label);
      if (!presetObj) {
        showWarning(`Пресет «${presetPick.label}» не найден в _presets`);
        return;
      }

      /* ---------- скрипты из пресета ---------- */
      const scriptObjs = presetObj.scripts
        .map((n) => scriptsRepo.getByKey(n))
        .filter(Boolean);

      if (!scriptObjs.length) {
        showWarning("Ни одного доступного скрипта для генерации не найдено.");
        return;
      }

      /* ---------- подходящие шаблоны ---------- */
      const templates = tplRepo
        .getAll()
        .filter((tpl) =>
          scriptObjs.some((s) => isTemplateApplicable(tpl, s!, entityObj))
        );
      if (!templates.length) {
        showWarning(
          "Не найдено шаблонов, подходящих под выбранный пресет и сущность."
        );
        return;
      }

      const manager = new TemplateManager(partRepo);

      /* ---------- генерация ---------- */
      for (const scr of scriptObjs) {
        const applicableTemplates = templates.filter((tpl) =>
          isTemplateApplicable(tpl, scr!, entityObj)
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
            script: scr!,
            output: outputConfig,
          };

          await manager.generate(request);
        }
      }

      showInfo(
        `Генерация по пресету «${presetObj.key}» для сущности «${entityObj.name}» завершена`
      );
    },
    (err) => showError(`Ошибка: ${err.message}`)
  );
}
