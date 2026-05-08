// src/interfaces/agents/codegen-config.interface.ts

import { z } from "zod";

export const CodegenConfigSchema = z.object({
  /**
   * Папка, в которой хранятся исходные данные для генерации:
   * шаблоны (.hbs), скрипты, настройки сущностей и пресеты.
   * Обычно: "codegen" или ".codegen".
   */
  configFolder: z.string().min(1).default("codegen"),

  output: z.object({
    /**
     * Базовая директория, куда будут сохраняться результаты генерации (итоговые файлы).
     * Например: "src/generated" или "packages/api/src".
     */
    path: z.string().min(1).default("src/generated"),
    /**
     * Расширение по умолчанию для генерируемых файлов, если оно не переопределено в самом шаблоне.
     * Например: ".ts" или ".dart".
     */
    extention: z.string().default(".ts"),
    /**
     * Порядок формирования вложенности папок (сегментов пути) при сохранении файла.
     * Например, ["entity", "script"] создаст структуру: /<имя_сущности>/<имя_скрипта>/.
     */
    pathOrder: z
      .array(z.enum(["entity", "script"]))
      .default(["entity", "script"]),
    /**
     * Порядок формирования составного имени файла.
     * Например, ["entity", "script", "template"] создаст файл: user.create-action.controller.ts
     */
    nameOrder: z
      .array(z.enum(["entity", "script", "template"]))
      .default(["entity", "script", "template"]),
  }),

  barrel: z.object({
    /**
     * Имя генерируемого barrel-файла (без расширения).
     * По умолчанию: "index". Вместе с extention образует "index.ts".
     */
    name: z.string().default("index"),
    naming: z.object({
      /**
       * Режим формирования экспортов внутри barrel-файла:
       * - "withoutAs" -> генерирует обычные экспорты: export * from './some-file';
       * - "withAs" -> генерирует неймспейсы: export * as SomeFile from './some-file';
       */
      mode: z.enum(["withoutAs", "withAs"]).default("withoutAs"),
      /**
       * Название стратегии форматирования имени алиаса (применяется только если barrelMode: "withAs").
       * Например: "default" или "camelCase".
       */
      strategy: z.string().default("default"),
      /**
       * Дополнительные опции для стратегии именования.
       */
      opts: z
        .object({
          /**
           * Разделитель для разбиения сегментов пути.
           * Может быть строкой (регуляркой) или массивом символов.
           */
          separator: z.union([z.string(), z.array(z.string())]).optional(),
        })
        .default({}),
    }),
    ignore: z.object({
      /**
       * Массив путей или glob-масок (например, ["/*.spec.ts", "old-modules"]),
       * которые будут полностью проигнорированы при синхронизации (создании) индексных файлов.
       */
      path: z.array(z.string()).default([]),
      /**
       * Маркеры для пропуска папок при генерации barrel-файла.
       * Если имя папки содержит любую из этих строк (например, ".module"),
       * скрипт не будет создавать внутри неё index.ts.
       */
      foldersName: z.array(z.string()).default([]),
    }),
    /**
     * Корневая папка, начиная с которой скрипт будет обходить директории
     * для автоматического создания/обновления barrel-файлов.
     * Если не указано, берется значение из outputPath.
     */
    path: z.string().optional(),
    /**
     * Расширение для создаваемых barrel-файлов (индексных файлов).
     * Обычно: ".ts" или ".tsx".
     */
    extention: z.string().default(".ts"),
  }),

  comment: z.object({
    /**
     * Список расширений файлов (например, [".ts", ".tsx", ".dart"]),
     * в которые скрипт будет автоматически добавлять комментарий с путем к файлу в первой строке.
     */
    extentions: z.array(z.string()).default([".ts", ".tsx", ".dart"]),
    /**
     * Строки-маркеры (префиксы), которые скрипт будет искать в начале файла для удаления
     * устаревших комментариев пути перед тем, как записать туда актуальный путь.
     */
    removalPatterns: z.array(z.string()).default([]),
  }),
});

export type ICodegenConfig = z.infer<typeof CodegenConfigSchema>;
