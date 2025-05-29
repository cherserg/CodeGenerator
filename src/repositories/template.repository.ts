// src/repositories/template.repository.ts
import { IGenericRepository } from "../interfaces/agents/repository.interface";
import { ITemplate } from "../interfaces/entities/template.interface";

export class TemplateRepository
  implements IGenericRepository<ITemplate, string>
{
  private store: Record<string, ITemplate>;

  constructor(initial: Record<string, ITemplate> = {}) {
    this.store = { ...initial };
  }

  public getAll(): ITemplate[] {
    return Object.values(this.store);
  }

  public getByKey(key: string): ITemplate | undefined {
    return this.store[key];
  }

  public upsert(item: ITemplate): void {
    this.store[item.key] = item;
  }

  public remove(key: string): void {
    delete this.store[key];
  }
}
