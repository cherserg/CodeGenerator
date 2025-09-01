// src/services/rules/rule.registry.ts

import { ISyncRule } from "./rule.interface";
import { tsRules } from "./typescript.rules";
import { dartRules } from "./dart.rules";

// Реестр правил для разных расширений
export const ruleRegistry: Record<string, ISyncRule> = {
  ".ts": tsRules,
  ".tsx": tsRules,
  ".js": tsRules,
  ".jsx": tsRules,
  ".dart": dartRules,
};
