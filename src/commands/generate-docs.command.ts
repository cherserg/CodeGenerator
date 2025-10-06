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

      /* ---------- оставляем только скрипты, у которых есть подходящие шаблоны ---------- */
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

      // Определяем системные переменные, которые не нужно запрашивать у пользователя
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
          outputExt,
          pathOrder: tpl.pathOrder ?? globalPathOrder,
          nameOrder: tpl.nameOrder ?? globalNameOrder,
        };

        for (const scr of scripts) {
          for (const ent of entities) {
            if (!isTemplateApplicable(tpl, scr, ent)) continue;

            // --- НОВАЯ ЛОГИКА: Обнаружение и запрос динамических переменных ---
            const userVariables: Record<string, string> = {};
            const placeholders = new Set<string>();
            const combinedTemplateString = `${tpl.content} ${
              tpl.pathName ?? ""
            }`;
            const placeholderRegex = /{{\s*(\w+)\s*}}/g;
            let match;

            while (
              (match = placeholderRegex.exec(combinedTemplateString)) !== null
            ) {
              placeholders.add(match[1]);
            }

            const dynamicVariables = [...placeholders].filter(
              (p) => !SYSTEM_VARIABLES.has(p)
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
                // Пользователь отменил ввод
                wasCancelled = true;
                break;
              }
              userVariables[varName] = value.trim();
            }

            if (wasCancelled) {
              showWarning("Генерация отменена.");
              // Прерываем только текущую итерацию, чтобы не отменять всю генерацию
              continue;
            }
            // --- КОНЕЦ НОВОЙ ЛОГИКИ ---

            const req: IGenerationRequest = {
              template: tpl,
              script: scr,
              entity: ent,
              output: outputConfig,
              userVariables, // Передаем собранные переменные
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
