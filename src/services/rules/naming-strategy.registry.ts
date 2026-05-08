// src/services/rules/naming-strategy.registry.ts

export type NamingStrategy = (pathSegment: string) => string;

export interface INamingStrategy {
  label: string;
  description: string;
  execute: NamingStrategy;
}

export const pascalCaseNamingStrategy: INamingStrategy = {
  label: "pascalCase",
  description:
    "Преобразует строку в PascalCase, используя точки, дефисы и подчеркивания как разделители. Пример: 'user.entity-dto' -> 'UserEntityDto'",
  execute: (pathSegment: string): string => {
    if (!pathSegment) {
      return "";
    }
    return pathSegment
      .split(/[.\-_]+/)
      .filter((word) => word.length > 0)
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join("");
  },
};

export const camelCaseNamingStrategy: INamingStrategy = {
  label: "camelCase",
  description:
    "Преобразует строку в camelCase, используя точки, дефисы и подчеркивания как разделители. Пример: 'user.entity-dto' -> 'userEntityDto'",
  execute: (pathSegment: string): string => {
    if (!pathSegment) {
      return "";
    }
    const parts = pathSegment
      .split(/[.\-_]+/)
      .filter((word) => word.length > 0);
    if (parts.length === 0) {
      return "";
    }

    return parts
      .map((word, index) => {
        const transformed = word.toLowerCase();
        if (index === 0) {
          return transformed;
        }
        return transformed.charAt(0).toUpperCase() + transformed.slice(1);
      })
      .join("");
  },
};

export const namingStrategies: Record<string, INamingStrategy> = {
  pascalCase: pascalCaseNamingStrategy,
  camelCase: camelCaseNamingStrategy,
};

export function getNamingStrategy(name?: string): NamingStrategy {
  if (name !== undefined && typeof name === "string") {
    const entry = namingStrategies[name];
    if (entry) {
      return entry.execute;
    }
  }

  const fallback = namingStrategies["pascalCase"];
  if (!fallback) {
    throw new Error(
      "Критическая ошибка: стратегия pascalCase не найдена в реестре.",
    );
  }
  return fallback.execute;
}
