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

    return result.data;
  } catch (error: unknown) {
    return CodegenConfigSchema.parse({});
  }
}
