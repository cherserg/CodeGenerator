// src/utils/quick-pick.service.ts
import * as vscode from "vscode";

/**
 * Унифицированный помощник для показа QuickPick-списков.
 * 1. Сортирует входной массив строк по алфавиту (locale "ru", numeric = true).
 * 2. Показывает список с множественным выбором.
 * 3. Возвращает массив выбранных значений (строк).
 */
export class QuickPickService {
  public static async pickStrings(
    values: string[],
    placeHolder: string,
    canPickMany = true
  ): Promise<string[]> {
    // Алфавитная сортировка с учётом цифр (1, 2, 10 и т.д.)
    const sorted = [...values].sort((a, b) =>
      a.localeCompare(b, "ru", { numeric: true, sensitivity: "base" })
    );

    const items: vscode.QuickPickItem[] = sorted.map((v) => ({ label: v }));

    // Явно указываем тип возвращаемого значения как массив QuickPickItem,
    // потому что при передаче canPickMany: true TS всё равно может вывести объединённый тип.
    const picked = (await vscode.window.showQuickPick(items, {
      canPickMany,
      placeHolder,
    })) as vscode.QuickPickItem[] | undefined;

    if (!picked || picked.length === 0) {
      throw new Error("Ничего не выбрано");
    }

    return picked.map((p: vscode.QuickPickItem) => p.label);
  }
}
