// src/services/rules/typescript.rules.ts

import { Dirent } from "fs";
import { ICodegenConfig } from "../../interfaces/agents/codegen-config.interface";
import { getNamingStrategy } from "./naming-strategy.registry";
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

  generateContent(
    folders: string[],
    files: string[],
    syncExt: string,
    config: ICodegenConfig,
  ): string {
    if (folders.length === 0 && files.length === 0) {
      return `export * from './';\n`;
    }

    const isWithAs = config.barrel.naming.mode === "withAs";
    const strategy = getNamingStrategy(config.barrel.naming.strategy);

    const folderExports = folders.map((f) => {
      if (isWithAs) {
        const alias = strategy(f);
        return `export * as ${alias} from './${f}';`;
      }
      return `export * from './${f}';`;
    });

    const fileExports = files.map((f) => {
      if (isWithAs) {
        const alias = strategy(f);
        return `export * as ${alias} from './${f}';`;
      }
      return `export * from './${f}';`;
    });

    return [...folderExports, ...fileExports, ""].join("\n");
  }
}

export const tsRules = new TypeScriptRules();
