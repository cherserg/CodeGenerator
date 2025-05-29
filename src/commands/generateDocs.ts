// src/commands/generateDocs.ts

import * as fs from "fs/promises";
import { registerCommand } from "./_common";
import { TemplateRepository } from "../repositories/template.repository";
import { TemplatePartRepository } from "../repositories/template-part.repository";
import { ScriptRepository } from "../repositories/script.repository";
import { EntityRepository } from "../repositories/entity.repository";
import { RepositoryLoader } from "../loaders/repository.loader";
import { TemplateManager } from "../managers/template.manager";
import { IGenerationRequest } from "../interfaces/entities/gen-request.interface";

import { readCodegenConfig } from "../utils/read-config.util";
import { getWorkspaceRoot, showInfo, showError } from "../utils/vscode.utils";
import { pickScripts, pickEntities, pickTemplates } from "../utils/pick.utils";

export function registerGenerateDocsCommand(context: any) {
  registerCommand(
    context,
    "codegenerator.generateDocs",
    async () => {
      const root = getWorkspaceRoot();
      const {
        configFolder,
        outputPath: globalOutputPath,
        outputExt,
        pathOrder: globalPathOrder,
      } = await readCodegenConfig(root);
      const baseDir = `${root}/${configFolder}`;

      const tplRepo = new TemplateRepository();
      const partRepo = new TemplatePartRepository();
      const scriptsRepo = new ScriptRepository();
      const entitiesRepo = new EntityRepository();
      await new RepositoryLoader(
        tplRepo,
        partRepo,
        scriptsRepo,
        entitiesRepo
      ).loadAll(baseDir);

      const scripts = await pickScripts(
        scriptsRepo.getAll(),
        "Выберите скрипты"
      );
      const entities = await pickEntities(
        entitiesRepo.getAll(),
        "Выберите сущности (или пункт «Без сущности»)"
      );
      const templates = await pickTemplates(
        tplRepo.getAll(),
        scripts,
        entities,
        "Выберите шаблоны для генерации"
      );

      const manager = new TemplateManager(partRepo);

      for (const tpl of templates) {
        // Мержим глобальные и шаблонные настройки output
        const effectiveOutputPath = tpl.outputPath
          ? `${root}/${tpl.outputPath}`
          : `${root}/${globalOutputPath}`;
        const effectivePathOrder = tpl.pathOrder ?? globalPathOrder;
        const outputConfig = {
          outputPath: effectiveOutputPath,
          outputExt,
          pathOrder: effectivePathOrder,
        };

        for (const scr of scripts) {
          if (!tpl.applicableScripts.includes(scr.name)) continue;
          for (const ent of entities) {
            if (
              ent &&
              tpl.applicableEntities &&
              tpl.applicableEntities.length > 0 &&
              !tpl.applicableEntities.includes(ent.name)
            )
              continue;

            const req: IGenerationRequest = {
              template: tpl,
              script: scr,
              entity: ent,
              output: outputConfig,
            };
            await manager.generate(req);
          }
        }
      }
      showInfo("Генерация завершена");
    },
    (err) => showError(`Ошибка: ${err.message}`)
  );
}
