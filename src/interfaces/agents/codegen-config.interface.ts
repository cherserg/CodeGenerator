import { z } from "zod";

export const CodegenConfigSchema = z
  .object({
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
      mode: z.enum(["classic", "node"]).default("classic"),
      name: z.string().default("index"),
      naming: z.object({
        mode: z.enum(["withoutAs", "withAs"]).default("withoutAs"),
        strategy: z.string().default("default"),
        opts: z
          .object({
            separators: z.array(z.string()).optional().default(["-", "_"]),
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
      path: z.union([z.string(), z.array(z.string())]).optional(),
      extention: z.string().default(".ts"),
    }),

    comment: z.object({
      extentions: z.array(z.string()).default([".ts", ".tsx", ".dart"]),
      removalPatterns: z.array(z.string()).default([]),
    }),
  })
  .transform((data) => {
    let resolvedPaths: string[];
    if (!data.barrel.path) {
      resolvedPaths = [data.output.path];
    } else if (typeof data.barrel.path === "string") {
      resolvedPaths = [data.barrel.path];
    } else {
      resolvedPaths = data.barrel.path;
    }

    return {
      ...data,
      barrel: {
        ...data.barrel,
        path: resolvedPaths,
      },
    };
  });

export type ICodegenConfig = z.infer<typeof CodegenConfigSchema>;
