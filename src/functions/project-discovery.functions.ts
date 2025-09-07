// src/functions/project-discovery.functions.ts

import * as path from "path";
import * as fs from "fs/promises";

export interface IProject {
  name: string; // Имя папки проекта
  path: string; // Полный путь к папке проекта
}

/**
 * Рекурсивно ищет все файлы codegen.json в рабочем пространстве.
 * @param rootPath Корневой путь для поиска.
 * @returns Массив объектов IProject.
 */
export async function findProjectsInWorkspace(
  rootPath: string
): Promise<IProject[]> {
  const projects: IProject[] = [];
  const visitedDirs = new Set<string>();

  async function findCodegenFiles(dir: string) {
    if (visitedDirs.has(dir)) {
      return;
    }
    visitedDirs.add(dir);

    // Игнорируем тяжелые папки для ускорения поиска
    const baseName = path.basename(dir);
    if (baseName === "node_modules" || baseName === ".git") {
      return;
    }

    try {
      const entries = await fs.readdir(dir, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          await findCodegenFiles(fullPath);
        } else if (entry.name === "codegen.json") {
          projects.push({
            name: path.basename(dir), // Используем имя папки как имя проекта
            path: dir,
          });
        }
      }
    } catch (error) {
      // Игнорируем ошибки доступа, если не можем прочитать директорию
      console.warn(`Could not read directory: ${dir}`, error);
    }
  }

  await findCodegenFiles(rootPath);
  return projects;
}
