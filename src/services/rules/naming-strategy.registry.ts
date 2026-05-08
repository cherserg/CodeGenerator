// src/services/rules/naming-strategy.registry.ts

export type NamingStrategyOpts = {
  separator?: string | string[];
};

export type NamingStrategy = (
  pathSegment: string,
  opts?: NamingStrategyOpts,
) => string;

export interface INamingStrategy {
  label: string;
  description: string;
  execute: NamingStrategy;
}

/**
 * Создает регулярное выражение для split.
 * Использует незахватывающую группу (?:...), чтобы разделители НЕ попадали в результат split.
 */
function getSplitRegex(opts?: NamingStrategyOpts): RegExp {
  const sep = opts?.separator;
  if (!sep) return /[.\-_]+/;

  if (Array.isArray(sep)) {
    // Экранируем спецсимволы и собираем в группу (?:a|b|c)
    const escaped = sep
      .map((s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
      .join("|");
    return new RegExp(`(?:${escaped})+`);
  }

  // Если передана строка, считаем её готовой регуляркой
  return new RegExp(sep);
}

export const pascalCaseNamingStrategy: INamingStrategy = {
  label: "pascalCase",
  description:
    "Преобразует строку в PascalCase. Разделители используются только для разбивки и удаляются.",
  execute: (pathSegment: string, opts?: NamingStrategyOpts): string => {
    if (!pathSegment) return "";
    const regex = getSplitRegex(opts);
    return pathSegment
      .split(regex)
      .filter((word) => word.length > 0)
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join("");
  },
};

export const camelCaseNamingStrategy: INamingStrategy = {
  label: "camelCase",
  description:
    "Преобразует строку в camelCase. Разделители используются только для разбивки и удаляются.",
  execute: (pathSegment: string, opts?: NamingStrategyOpts): string => {
    if (!pathSegment) return "";
    const regex = getSplitRegex(opts);
    const parts = pathSegment.split(regex).filter((word) => word.length > 0);
    if (parts.length === 0) return "";

    return parts
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
  const fallback = namingStrategies["pascalCase"];
  if (!fallback) {
    throw new Error(
      "Критическая ошибка: стратегия pascalCase не найдена в реестре.",
    );
  }
  return fallback.execute;
}
