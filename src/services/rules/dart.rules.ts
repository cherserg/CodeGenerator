// src/services/rules/dart.rules.ts

import { Dirent } from "fs";
import { ISyncRule } from "./rule.interface";

class DartRules implements ISyncRule {
  collectFiles(dirents: Dirent[], indexFileName: string): string[] {
    const indexFileLower = indexFileName.toLowerCase();

    return dirents
      .filter((d) => {
        const lowerName = d.name.toLowerCase();
        if (!d.isFile()) return false;

        const isDartFile = lowerName.endsWith(".dart");
        const isIndexFile = lowerName === indexFileLower;
        const isPartFile =
          lowerName.endsWith(".freezed.dart") || lowerName.endsWith(".g.dart");

        return isDartFile && !isIndexFile && !isPartFile;
      })
      .map((d) => d.name.slice(0, -5)) // .dart = 5 символов
      .sort((a, b) => a.localeCompare(b));
  }

  generateContent(folders: string[], files: string[], syncExt: string): string {
    if (folders.length === 0 && files.length === 0) {
      return ``;
    }
    // Для Dart предполагаем, что вложенные папки также содержат index.dart
    const folderExports = folders.map((f) => `export '${f}/index.dart';`);
    const fileExports = files.map((f) => `export '${f}${syncExt}';`);
    return [...folderExports, ...fileExports, ""].join("\n");
  }
}

export const dartRules = new DartRules();
