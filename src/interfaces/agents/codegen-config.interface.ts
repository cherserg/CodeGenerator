// src/interfaces/agents/codegen-config.interface.ts

import { z } from "zod";

export const CodegenConfigSchema = z.object({
  configFolder: z.string().min(1).default("codegen"),

  output: z.object({
    path: z.string().min(1).default("src/generated"),
    extention: z.string().default(".ts"),
    pathOrder: z
      .array(z.enum(["entity", "script"]))
      .default(["entity", "script"]),
    nameOrder: z
      .array(z.enum(["entity", "script", "template"]))
      .default(["entity", "script", "template"]),
  }),

  barrel: z.object({
    name: z.string().default("index"),
    naming: z.object({
      mode: z.enum(["withoutAs", "withAs"]).default("withoutAs"),
      strategy: z.string().default("default"),
      opts: z
        .object({
          /**
           * Символы, которые разбивают строку на слова.
           * Файл "flow-monitor" -> ["Flow", "Monitor"]
           */
          separators: z.array(z.string()).optional().default(["-", "_"]),
          /**
           * Символы, которые отсекают чтение.
           * Файл "chunk.processor" -> берем только "chunk"
           */
          terminators: z.array(z.string()).optional().default(["."]),
        })
        .default({
          separators: ["-", "_"],
          terminators: ["."],
        }),
    }),
    ignore: z.object({
      path: z.array(z.string()).default([]),
      foldersName: z.array(z.string()).default([]),
    }),
    path: z.string().optional(),
    extention: z.string().default(".ts"),
  }),

  comment: z.object({
    extentions: z.array(z.string()).default([".ts", ".tsx", ".dart"]),
    removalPatterns: z.array(z.string()).default([]),
  }),
});

export type ICodegenConfig = z.infer<typeof CodegenConfigSchema>;
