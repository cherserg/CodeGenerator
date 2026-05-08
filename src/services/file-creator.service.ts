// src/services/file-creator.service.ts

import * as fs from "fs/promises";
import * as path from "path";
import prettier from "prettier";
import { getPathCommentLine } from "../functions/path-comment.functions";

export class FileCreatorService {
  public async save(
    outDir: string,
    fileName: string,
    content: string,
    workspaceRoot: string,
  ): Promise<void> {
    await fs.mkdir(outDir, { recursive: true });
    const fullPath = path.join(outDir, fileName);

    const pathComment = getPathCommentLine(fullPath, workspaceRoot);
    const rawFullBody = `${pathComment}\n\n${content}`;

    let prettierCfg: prettier.Options | null = null;
    try {
      prettierCfg = await prettier.resolveConfig(fullPath);
    } catch {}

    const ext = path.extname(fileName).toLowerCase();
    const parser: prettier.BuiltInParserName =
      ext === ".ts" || ext === ".tsx"
        ? "typescript"
        : ext === ".js" || ext === ".jsx"
          ? "babel"
          : ext === ".json"
            ? "json"
            : "babel";

    let formatted: string;
    try {
      formatted = await prettier.format(rawFullBody, {
        ...prettierCfg,
        parser,
        filepath: fullPath,
      });
    } catch {
      formatted = rawFullBody;
    }

    let isDifferent = true;
    try {
      const existing = await fs.readFile(fullPath, "utf-8");

      const normalize = (s: string) => s.replace(/\r\n/g, "\n").trim();
      if (normalize(existing) === normalize(formatted)) {
        isDifferent = false;
      }
    } catch (error: unknown) {
      const isNodeError = (err: unknown): err is { code: string } =>
        typeof err === "object" && err !== null && "code" in err;

      if (isNodeError(error) && error.code !== "ENOENT") {
        throw error;
      }
    }

    if (isDifferent) {
      try {
        await fs.access(fullPath);
        const now = new Date();
        const pad = (n: number) => n.toString().padStart(2, "0");
        const stamp =
          now.getFullYear() +
          pad(now.getMonth() + 1) +
          pad(now.getDate()) +
          "T" +
          pad(now.getHours()) +
          pad(now.getMinutes()) +
          pad(now.getSeconds());
        await fs.copyFile(fullPath, `${fullPath}.bak.${stamp}`);
      } catch {}

      await fs.writeFile(fullPath, formatted, "utf-8");
    }
  }
}
