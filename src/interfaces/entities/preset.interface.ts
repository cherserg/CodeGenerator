// src/interfaces/entities/preset.interface.ts
export interface IPreset {
  /** Уникальный ключ пресета (например `base-module-create`) */
  key: string;
  /** Массив имён скриптов, которые входят в пресет */
  scripts: string[];
  /** Описание пресета (опционально) */
  description?: string;
}
