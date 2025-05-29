// src/services/path-creator.service.ts

import { IOutput } from "../interfaces/entities/gen-request.interface";
import * as path from "path";

export class PathCreatorService {
  /**
   * Формирует путь вывода в соответствии с output.pathOrder:
   * сначала output.outputPath, потом сегменты entity.path и script.path
   * в том порядке, который указан в output.pathOrder.
   */
  public generate(
    output: IOutput,
    entityVars: Record<string, string>,
    scriptVars: Record<string, string>
  ): string {
    const order = output.pathOrder ?? ["entity", "script"];
    const segments = [
      output.outputPath,
      ...order.map((segment) => {
        if (segment === "entity") return entityVars["path"];
        if (segment === "script") return scriptVars["path"];
      }),
    ].filter(Boolean) as string[];
    return path.join(...segments) + path.sep;
  }
}
