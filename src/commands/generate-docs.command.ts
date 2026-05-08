// src/commands/generate-docs.command.ts

import * as vscode from "vscode";
import { IGenerationRequest } from "../interfaces/entities/gen-request.interface";
import { RepositoryLoader } from "../loaders/repository.loader";
import { TemplateManager } from "../managers/template.manager";
import { EntityRepository } from "../repositories/entity.repository";
import { PresetRepository } from "../repositories/preset.repository";
import { ScriptRepository } from "../repositories/script.repository";
import { TemplatePartRepository } from "../repositories/template-part.repository";
import { TemplateRepository } from "../repositories/template.repository";
import { registerCommand } from "./_common";

import {
  pickEntities,
  pickProject,
  pickScripts,
  pickTemplates,
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

export function registerGenerateDocsCommand(context: vscode.ExtensionContext) {
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
        "Выберите проект для генерации документации",
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
        presetsRepo,
      ).loadAll(baseDir);

      const entities = await pickEntities(
        entitiesRepo.getAll(),
        "Выберите сущности (или пункт «Без сущности»)",
      );

      const allTemplates = tplRepo.getAll();
      const scriptsWithTemplates = scriptsRepo
        .getAll()
        .filter((scr) =>
          allTemplates.some((tpl) =>
            entities.some((ent) => isTemplateApplicable(tpl, scr, ent)),
          ),
        );

      if (!scriptsWithTemplates.length) {
        showWarning(
          "Под выбранные сущности не найдено ни одного скрипта с шаблонами.",
        );
        return;
      }

      const scripts = await pickScripts(
        scriptsWithTemplates,
        "Выберите скрипты",
      );

      const templates = await pickTemplates(
        allTemplates,
        scripts,
        entities,
        "Выберите шаблоны для генерации",
      );

      const manager = new TemplateManager(partRepo);

      const SYSTEM_VARIABLES = new Set([
        "entityName",
        "entitySmallName",
        "entityBigName",
        "scriptName",
        "scriptSmallName",
        "scriptBigName",
        "pathName",
        "path",
      ]);

      for (const tpl of templates) {
        const effectiveOutputPath = tpl.outputPath
          ? `${projectRoot}/${tpl.outputPath}`
          : `${projectRoot}/${globalOutputPath}`;
        const outputConfig = {
          outputPath: effectiveOutputPath,
          outputExt: globalOutputExtention,
          pathOrder: tpl.pathOrder ?? globalPathOrder,
          nameOrder: tpl.nameOrder ?? globalNameOrder,
        };

        for (const scr of scripts) {
          for (const ent of entities) {
            if (!isTemplateApplicable(tpl, scr, ent)) continue;

            const userVariables: Record<string, string> = {};
            const placeholders = new Set<string>();
            const combinedTemplateString = `${tpl.content} ${
              tpl.pathName ?? ""
            }`;
            const placeholderRegex = /{{\s*(\w+)\s*}}/g;
            let match: RegExpExecArray | null;

            while (
              (match = placeholderRegex.exec(combinedTemplateString)) !== null
            ) {
              placeholders.add(match[1]);
            }

            const dynamicVariables = [...placeholders].filter(
              (p) => !SYSTEM_VARIABLES.has(p),
            );

            let wasCancelled = false;
            for (const varName of dynamicVariables) {
              const value = await vscode.window.showInputBox({
                prompt: `Введите значение для переменной "{{${varName}}}"`,
                placeHolder: `Например: SignIn, CreateUser`,
                validateInput: (text) => {
                  return text.trim().length > 0
                    ? null
                    : "Значение не может быть пустым.";
                },
              });

              if (value === undefined) {
                wasCancelled = true;
                break;
              }
              userVariables[varName] = value.trim();
            }

            if (wasCancelled) {
              showWarning("Генерация отменена.");
              continue;
            }

            const req: IGenerationRequest = {
              template: tpl,
              script: scr,
              entity: ent,
              output: outputConfig,
              userVariables,
            };
            await manager.generate(req, workspaceRoot);
          }
        }
      }
      showInfo("Генерация завершена");
    },
    (err: unknown) => {
      const message = err instanceof Error ? err.message : String(err);
      showError(`Ошибка: ${message}`);
    },
  );
}
