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
import { PresetRepository } from "../repositories/preset.repository";

import { ITemplate } from "../interfaces/entities/template.interface";
import { IScript } from "../interfaces/entities/script.interface";
import { IEntity } from "../interfaces/entities/entity.interface";
import { IPreset } from "../interfaces/entities/preset.interface";

export class RepositoryLoader {
  constructor(
    private templatesRepo: TemplateRepository,
    private partsRepo: TemplatePartRepository,
    private scriptsRepo: ScriptRepository,
    private entitiesRepo: EntityRepository,
    private presetsRepo: PresetRepository
  ) {}

  /** Рекурсивно собирает все файлы в директории dir */
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
        results = results.concat(await this.getFilesRecursively(fullPath));
      } else {
        results.push(fullPath);
      }
    }
    return results;
  }

  /** Загружает все .hbs-файлы из baseDir/subdir и всех подпапок */
  private async loadFromHbs<T>(
    baseDir: string,
    subdir: string,
    upsertFn: (item: T) => void
  ) {
    const dir = path.join(baseDir, subdir);
    const hbsFiles = (await this.getFilesRecursively(dir)).filter((f) =>
      f.endsWith(".hbs")
    );

    await Promise.all(
      hbsFiles.map(async (full) => {
        const relative = path.relative(dir, full);
        const raw = await fs.readFile(full, "utf8");
        try {
          const { data, content } = matter(raw);
          upsertFn({ ...(data as object), content } as T);
        } catch (e) {
          console.warn(`Не удалось разобрать ${subdir}/${relative}:`, e);
        }
      })
    );
  }

  public async loadAll(baseDir: string): Promise<void> {
    await Promise.all([
      this.loadFromHbs<ITemplatePart>(baseDir, "t-parts", (p) =>
        this.partsRepo.upsert(p)
      ),
      this.loadFromHbs<ITemplate>(baseDir, "_templates", (t) =>
        this.templatesRepo.upsert(t)
      ),
      this.loadFromHbs<IScript>(baseDir, "_scripts", (s) =>
        this.scriptsRepo.upsert(s)
      ),
      this.loadFromHbs<IEntity>(baseDir, "_entities", (e) =>
        this.entitiesRepo.upsert(e)
      ),
      this.loadFromHbs<IPreset>(baseDir, "_e.presets", (p) =>
        this.presetsRepo.upsert(p)
      ),
    ]);
  }
}
