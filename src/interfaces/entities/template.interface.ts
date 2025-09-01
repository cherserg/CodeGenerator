// src/interfaces/entities/template.interface.ts

export interface TemplatePart {
  key: string;
  content: string;
}

export interface ITemplate {
  /** Уникальный ключ шаблона (filename без пути) */
  key: string;
  /** Основной контент шаблона */
  content: string;
  /** Описание (опционально) */
  description?: string;
  /** Список скриптов, к которым применим шаблон */
  applicableScripts?: string[];
  /** Список сущностей, к которым применим шаблон */
  applicableEntities?: string[];
  /** Список скриптов, к которым шаблон неприменим */
  nonApplicableScripts?: string[];
  /** Список сущностей, к которым шаблон неприменим */
  nonApplicableEntities?: string[];
  /** Расширение выходного файла (например, ".ts") */
  outputExt: string;
  /** Путь вывода для этого шаблона (относительно workspace root) */
  outputPath?: string;
  /** Порядок сегментов пути (существующая опция) */
  pathOrder?: Array<"entity" | "script">;
  /** Имя шаблона для генерации имени файла (опционально, из frontmatter) */
  pathName?: string;
  /** Порядок частей имени файла для этого шаблона */
  nameOrder?: Array<"entity" | "script" | "template">;
}
