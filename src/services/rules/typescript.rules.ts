// src/services/rules/typescript.rules.ts

import { Dirent } from "fs";
import { ISyncRule } from "./rule.interface";

class TypeScriptRules implements ISyncRule {
  collectFiles(dirents: Dirent[], barrelName: string): string[] {
    const indexTs = `${barrelName}.ts`.toLowerCase();
    const indexTsx = `${barrelName}.tsx`.toLowerCase();

    return dirents
      .filter((d) => {
        const lowerName = d.name.toLowerCase();
        return (
          d.isFile() &&
          (lowerName.endsWith(".ts") || lowerName.endsWith(".tsx")) &&
          lowerName !== indexTs &&
          lowerName !== indexTsx
        );
      })
      .map((d) => {
        if (d.name.endsWith(".tsx")) {
          return d.name.slice(0, -4);
        }
        return d.name.slice(0, -3);
      })
      .sort((a, b) => a.localeCompare(b));
  }

  generateContent(folders: string[], files: string[], syncExt: string): string {
    if (folders.length === 0 && files.length === 0) {
      // Для пустых папок генерируем экспорт всего из текущей директории
      return `export * from './';\n`;
    }
    const folderExports = folders.map((f) => `export * from './${f}';`);
    const fileExports = files.map((f) => `export * from './${f}';`);
    return [...folderExports, ...fileExports, ""].join("\n");
  }
}

export const tsRules = new TypeScriptRules();
