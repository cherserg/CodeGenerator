// src/commands/restoreDocs.ts

import * as fs from "fs/promises";
import * as path from "path";
import { registerCommand } from "./_common";
import { TemplateRepository } from "../repositories/template.repository";
import { TemplatePartRepository } from "../repositories/template-part.repository";
import { ScriptRepository } from "../repositories/script.repository";
import { EntityRepository } from "../repositories/entity.repository";
import { RepositoryLoader } from "../loaders/repository.loader";
import { PathCreatorService } from "../services/path-creator.service";
import { NameBuilderService } from "../services/name-builder.service";

import { readCodegenConfig } from "../utils/read-config.util";
import {
  getWorkspaceRoot,
  showInfo,
  showError,
  showWarning,
} from "../utils/vscode.utils";
import { pickScripts, pickEntities, pickTemplates } from "../utils/pick.utils";

export function registerRestoreDocsCommand(context: any) {
  registerCommand(
    context,
    "codegenerator.restoreFromBackup",
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
      await new RepositoryLoader(
        tplRepo,
        partRepo,
        scriptsRepo,
        entitiesRepo
      ).loadAll(baseDir);

      const scripts = await pickScripts(
        scriptsRepo.getAll(),
        "Выберите скрипты для восстановления"
      );
      const entities = await pickEntities(
        entitiesRepo.getAll(),
        "Выберите сущности для восстановления"
      );
      const templates = await pickTemplates(
        tplRepo.getAll(),
        scripts,
        entities,
        "Выберите шаблоны для восстановления"
      );

      const pathSvc = new PathCreatorService();
      const nameSvc = new NameBuilderService();

      for (const tpl of templates) {
        // Мержим глобальные и шаблонные настройки output
        const effectiveOutputPath = tpl.outputPath
          ? path.join(root, tpl.outputPath)
          : path.join(root, globalOutputPath);
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

            const entityVars = ent?.variables ?? {};
            const scriptVars = scr.variables;
            const outDir = pathSvc.generate(
              outputConfig,
              entityVars,
              scriptVars
            );
            const fileName = nameSvc.generate(
              entityVars,
              scriptVars,
              tpl,
              outputConfig
            );
            const fullPath = path.join(outDir, fileName);
            const dir = path.dirname(fullPath);

            let files: string[];
            try {
              files = await fs.readdir(dir);
            } catch (e: any) {
              showWarning(`Не удалось прочитать ${dir}: ${e.message}`);
              continue;
            }

            const latestBak = files
              .filter((f) => f.startsWith(fileName + ".bak."))
              .map((f) => ({
                name: f,
                ts: f.slice((fileName + ".bak.").length),
              }))
              .filter((x) => /^\d{8}T\d{6}$/.test(x.ts))
              .sort((a, b) => b.ts.localeCompare(a.ts))[0];

            if (!latestBak) {
              showWarning(`Резервных копий не найдено для ${fileName}`);
              continue;
            }

            const bakPath = path.join(dir, latestBak.name);
            await fs.copyFile(bakPath, fullPath);
          }
        }
      }

      showInfo("Восстановление завершено");
    },
    (err) => showError(`Ошибка восстановления: ${err.message}`)
  );
}
