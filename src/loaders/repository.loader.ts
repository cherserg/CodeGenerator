// src/loaders/repository.loader.ts
import * as fs from "fs/promises";
import { Dirent } from "fs";
import * as path from "path";
import matter from "gray-matter";

import { TemplateRepository } from "../repositories/template.repository";
import {
  TemplatePartRepository,
  ITemplatePart,
} from "../repositories/template-part.repository";
import { ScriptRepository } from "../repositories/script.repository";
import { EntityRepository } from "../repositories/entity.repository";

import { ITemplate } from "../interfaces/entities/template.interface";
import { IScript } from "../interfaces/entities/script.interface";
import { IEntity } from "../interfaces/entities/entity.interface";

export class RepositoryLoader {
  constructor(
    private templatesRepo: TemplateRepository,
    private partsRepo: TemplatePartRepository,
    private scriptsRepo: ScriptRepository,
    private entitiesRepo: EntityRepository
  ) {}

  /**
   * Рекурсивно собирает все файлы внутри директории dir.
   */
  private async getFilesRecursively(dir: string): Promise<string[]> {
    let results: string[] = [];
    let entries: Dirent[];

    try {
      entries = (await fs.readdir(dir, { withFileTypes: true })) as Dirent[];
    } catch {
      return results;
    }

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        const nested = await this.getFilesRecursively(fullPath);
        results = results.concat(nested);
      } else {
        results.push(fullPath);
      }
    }

    return results;
  }

  /**
   * Загружает все .hbs-файлы из baseDir/subdir и всех его подпапок,
   * парсит их через gray-matter и вызывает upsertFn для каждого объекта.
   */
  private async loadFromHbs<T>(
    baseDir: string,
    subdir: string,
    upsertFn: (item: T) => void
  ) {
    const dir = path.join(baseDir, subdir);
    const allFiles = await this.getFilesRecursively(dir);
    const hbsFiles = allFiles.filter((f) => f.endsWith(".hbs"));

    await Promise.all(
      hbsFiles.map(async (full) => {
        const relative = path.relative(dir, full);
        const raw = await fs.readFile(full, "utf8");
        try {
          const { data, content } = matter(raw);
          // Убираем общий ведущий отступ у каждой строки контента,
          // чтобы и для шаблонов, и для частей было единообразное форматирование
          const processedContent = content.replace(/^\s+/gm, "");
          const item = {
            ...(data as object),
            content: processedContent,
          } as T;
          upsertFn(item);
        } catch (e) {
          console.warn(`Не удалось разбить ${subdir}/${relative}:`, e);
        }
      })
    );
  }

  public async loadAll(baseDir: string): Promise<void> {
    await Promise.all([
      this.loadFromHbs<ITemplatePart>(baseDir, "parts", (p) =>
        this.partsRepo.upsert(p)
      ),
      this.loadFromHbs<ITemplate>(baseDir, "templates", (t) =>
        this.templatesRepo.upsert(t)
      ),
      this.loadFromHbs<IScript>(baseDir, "scripts", (s) =>
        this.scriptsRepo.upsert(s)
      ),
      this.loadFromHbs<IEntity>(baseDir, "entities", (e) =>
        this.entitiesRepo.upsert(e)
      ),
    ]);
  }
}
