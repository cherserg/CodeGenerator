// src/functions/read-config.functions.ts

import * as fs from "fs/promises";
import * as path from "path";
import {
  CodegenConfigSchema,
  ICodegenConfig,
} from "../interfaces/agents/codegen-config.interface";

export async function readCodegenConfig(root: string): Promise<ICodegenConfig> {
  const cfgPath = path.join(root, "codegen.json");

  try {
    const raw = await fs.readFile(cfgPath, "utf8");
    const json = JSON.parse(raw);

    const result = CodegenConfigSchema.safeParse(json);

    if (!result.success) {
      const errors = result.error.issues
        .map((issue) => `[${issue.path.join(".")}] ${issue.message}`)
        .join("\n");

      throw new Error(`Ошибка в структуре codegen.json:\n${errors}`);
    }

    const config = result.data;

    if (!config.barrel.path) {
      config.barrel.path = config.output.path;
    }

    return config;
  } catch (error: unknown) {
    const errMessage = error instanceof Error ? error.message : String(error);

    console.error(`❌ Ошибка чтения конфигурации: ${errMessage}`);

    // Возвращаем дефолты через parse({}), так как схема сама их подставит
    return CodegenConfigSchema.parse({});
  }
}
