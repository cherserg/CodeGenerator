// src/repositories/preset.repository.ts
import { IGenericRepository } from "../interfaces/agents/repository.interface";
import { IPreset } from "../interfaces/entities/preset.interface";

export class PresetRepository implements IGenericRepository<IPreset, string> {
  private store: Record<string, IPreset>;

  constructor(initial: IPreset[] = []) {
    this.store = initial.reduce(
      (acc, p) => {
        acc[p.key] = p;
        return acc;
      },
      {} as Record<string, IPreset>
    );
  }

  public getAll(): IPreset[] {
    return Object.values(this.store);
  }

  public getByKey(key: string): IPreset | undefined {
    return this.store[key];
  }

  public upsert(item: IPreset): void {
    this.store[item.key] = item;
  }

  public remove(key: string): void {
    delete this.store[key];
  }
}
