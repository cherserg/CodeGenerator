// src/repositories/script.repository.ts
import { IGenericRepository } from "../interfaces/agents/repository.interface";
import { IScript } from "../interfaces/entities/script.interface";

export class ScriptRepository implements IGenericRepository<IScript, string> {
  private store: Record<string, IScript>;

  constructor(initial: IScript[] = []) {
    this.store = initial.reduce((acc, s) => {
      acc[s.name] = s;
      return acc;
    }, {} as Record<string, IScript>);
  }

  public getAll(): IScript[] {
    return Object.values(this.store);
  }

  public getByKey(key: string): IScript | undefined {
    return this.store[key];
  }

  public upsert(item: IScript): void {
    this.store[item.name] = item;
  }

  public remove(key: string): void {
    delete this.store[key];
  }
}
