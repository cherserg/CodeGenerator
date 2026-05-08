// src/services/rules/naming-strategy.registry.ts

export type NamingStrategyOpts = {
  separators: string[];
  terminators: string[];
};

export type NamingStrategy = (
  pathSegment: string,
  opts: NamingStrategyOpts,
) => string;

export interface INamingStrategy {
  label: string;
  description: string;
  execute: NamingStrategy;
}

/**
 * Очищает сегмент пути: отсекает хвост по терминаторам и разбивает на слова по разделителям.
 */
function prepareWords(pathSegment: string, opts: NamingStrategyOpts): string[] {
  let result = pathSegment;

  // 1. Отсекаем всё, что идет после первого найденного терминатора
  if (opts.terminators.length > 0) {
    const escapedTerminators = opts.terminators
      .map((s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
      .join("|");
    const terminatorRegex = new RegExp(escapedTerminators);
    const match = result.match(terminatorRegex);
    if (match && match.index !== undefined) {
      result = result.substring(0, match.index);
    }
  }

  // 2. Разбираем на слова по separators
  const escapedSeparators = opts.separators
    .map((s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
    .join("|");
  const splitRegex = new RegExp(`(?:${escapedSeparators})+`);

  return result.split(splitRegex).filter((word) => word.length > 0);
}

export const pascalCaseNamingStrategy: INamingStrategy = {
  label: "pascalCase",
  description: "PascalCase с поддержкой отсекателей и разделителей слов.",
  execute: (pathSegment: string, opts: NamingStrategyOpts): string => {
    const words = prepareWords(pathSegment, opts);
    if (words.length === 0) return "";

    return words
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join("");
  },
};

export const camelCaseNamingStrategy: INamingStrategy = {
  label: "camelCase",
  description: "camelCase с поддержкой отсекателей и разделителей слов.",
  execute: (pathSegment: string, opts: NamingStrategyOpts): string => {
    const words = prepareWords(pathSegment, opts);
    if (words.length === 0) return "";

    return words
      .map((word, index) => {
        const transformed = word.toLowerCase();
        if (index === 0) return transformed;
        return transformed.charAt(0).toUpperCase() + transformed.slice(1);
      })
      .join("");
  },
};

export const namingStrategies: Record<string, INamingStrategy> = {
  pascalCase: pascalCaseNamingStrategy,
  camelCase: camelCaseNamingStrategy,
  default: pascalCaseNamingStrategy,
};

export function getNamingStrategy(name?: string): NamingStrategy {
  if (name !== undefined && typeof name === "string") {
    const entry = namingStrategies[name];
    if (entry) return entry.execute;
  }
  return namingStrategies["pascalCase"]!.execute;
}
