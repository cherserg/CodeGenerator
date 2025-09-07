// src/commands/generateDocs.ts
import { registerCommand } from "./_common";
import { TemplateRepository } from "../repositories/template.repository";
import { TemplatePartRepository } from "../repositories/template-part.repository";
import { ScriptRepository } from "../repositories/script.repository";
import { EntityRepository } from "../repositories/entity.repository";
import { PresetRepository } from "../repositories/preset.repository";
import { RepositoryLoader } from "../loaders/repository.loader";
import { TemplateManager } from "../managers/template.manager";
import { IGenerationRequest } from "../interfaces/entities/gen-request.interface";

import { readCodegenConfig } from "../functions/read-config.functions";
import {
  getWorkspaceRoot,
  showInfo,
  showError,
  showWarning,
} from "../functions/vscode.functions";
import {
  pickScripts,
  pickEntities,
  pickTemplates,
  pickProject,
} from "../functions/pick.functions";
import { isTemplateApplicable } from "../functions/template-applicability.functions";
import { findProjectsInWorkspace } from "../functions/project-discovery.functions";

export function registerGenerateDocsCommand(context: any) {
  registerCommand(
    context,
    "codegenerator.generateDocs",
    async () => {
      const workspaceRoot = getWorkspaceRoot();

      const projects = await findProjectsInWorkspace(workspaceRoot);
      if (projects.length === 0) {
        showWarning("Не найдено ни одного проекта с файлом codegen.json.");
        return;
      }

      const selectedProject = await pickProject(
        projects,
        "Выберите проект для генерации документации"
      );

      if (!selectedProject) {
        showWarning("Проект не выбран.");
        return;
      }

      const projectRoot = selectedProject.path;

      const {
        configFolder,
        outputPath: globalOutputPath,
        outputExt,
        pathOrder: globalPathOrder,
        nameOrder: globalNameOrder,
      } = await readCodegenConfig(projectRoot);
      const baseDir = `${projectRoot}/${configFolder}`;

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

      /* ---------- сначала выбираем сущности ---------- */
      const entities = await pickEntities(
        entitiesRepo.getAll(),
        "Выберите сущности (или пункт «Без сущности»)"
      );

      /* ---------- оставляем только скрипты, у которых есть подходящие шаблоны
                    для ХОТЯ БЫ одной из выбранных сущностей (или без сущности) ---------- */
      const allTemplates = tplRepo.getAll();
      const scriptsWithTemplates = scriptsRepo
        .getAll()
        .filter((scr) =>
          allTemplates.some((tpl) =>
            entities.some((ent) => isTemplateApplicable(tpl, scr, ent))
          )
        );

      if (!scriptsWithTemplates.length) {
        showWarning(
          "Под выбранные сущности не найдено ни одного скрипта с шаблонами."
        );
        return;
      }

      /* ---------- теперь выбор скриптов ---------- */
      const scripts = await pickScripts(
        scriptsWithTemplates,
        "Выберите скрипты"
      );

      /* ---------- и, наконец, выбор шаблонов ---------- */
      const templates = await pickTemplates(
        allTemplates,
        scripts,
        entities,
        "Выберите шаблоны для генерации"
      );

      const manager = new TemplateManager(partRepo);

      for (const tpl of templates) {
        const effectiveOutputPath = tpl.outputPath
          ? `${projectRoot}/${tpl.outputPath}`
          : `${projectRoot}/${globalOutputPath}`;
        const outputConfig = {
          outputPath: effectiveOutputPath,
          outputExt,
          pathOrder: tpl.pathOrder ?? globalPathOrder,
          nameOrder: tpl.nameOrder ?? globalNameOrder,
        };

        for (const scr of scripts) {
          for (const ent of entities) {
            if (!isTemplateApplicable(tpl, scr, ent)) continue;

            const req: IGenerationRequest = {
              template: tpl,
              script: scr,
              entity: ent,
              output: outputConfig,
            };
            await manager.generate(req, workspaceRoot);
          }
        }
      }
      showInfo("Генерация завершена");
    },
    (err) => showError(`Ошибка: ${err.message}`)
  );
}
