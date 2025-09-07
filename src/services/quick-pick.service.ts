// src/utils/quick-pick.service.ts
import * as vscode from "vscode";

/**
 * Унифицированный помощник для показа QuickPick-списков.
 * 1. Сортирует входной массив строк по алфавиту (locale "ru", numeric = true).
 * 2. Показывает список с возможностью одиночного или множественного выбора.
 * 3. Всегда возвращает массив выбранных значений (строк).
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

    // --- НАЧАЛО ИСПРАВЛЕНИЯ ---

    if (canPickMany) {
      // Логика для множественного выбора
      const pickedItems = await vscode.window.showQuickPick(items, {
        canPickMany: true,
        placeHolder,
      });

      if (!pickedItems || pickedItems.length === 0) {
        throw new Error("Ничего не выбрано");
      }
      return pickedItems.map((p) => p.label);
    } else {
      // Логика для одиночного выбора
      const pickedItem = await vscode.window.showQuickPick(items, {
        canPickMany: false,
        placeHolder,
      });

      if (!pickedItem) {
        throw new Error("Ничего не выбрано");
      }
      // Возвращаем результат в виде массива с одним элементом для унификации API
      return [pickedItem.label];
    }
    // --- КОНЕЦ ИСПРАВЛЕНИЯ ---
  }
}
