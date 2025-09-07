// src/interfaces/agents/repository.interface.ts

export type IGenericRepository<T, K = string> = {
  /** Возвращает все объекты */
  getAll(): T[];
  /** Ищет объект по ключу */
  getByKey(key: K): T | undefined;
  /** Добавляет новый объект (или обновляет, если ключ совпал) */
  upsert(item: T): void;
  /** Удаляет объект по ключу */
  remove(key: K): void;
};
