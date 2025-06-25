// src/services/name-builder.service.ts

import { IOutput } from "../interfaces/entities/gen-request.interface";
import { ITemplate } from "../interfaces/entities/template.interface";
import * as path from "path";

export class NameBuilderService {
  public generate(
    entityVars: Record<string, string>,
    scriptVars: Record<string, string>,
    template: ITemplate,
    output: IOutput
  ): string {
    const partsMap: Record<string, string | undefined> = {
      entity: entityVars["pathName"],
      script: scriptVars["pathName"] || "script",
      template: (() => {
        const raw =
          (template as any).pathName ||
          path.basename(template.key, path.extname(template.key));
        return raw.replace(/\./g, "");
      })(),
    };

    const order = output.nameOrder ?? ["entity", "script", "template"];
    const parts = order
      .map((key) => partsMap[key])
      .filter((v): v is string => Boolean(v));

    const ext = template.outputExt || output.outputExt;
    return parts.join(".") + ext;
  }
}
