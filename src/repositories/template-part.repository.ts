// src/repositories/template-part.repository.ts
import { IGenericRepository } from "../interfaces/agents/repository.interface";

export interface ITemplatePart {
  key: string;
  content: string;
}

export class TemplatePartRepository
  implements IGenericRepository<ITemplatePart, string>
{
  private store: Record<string, ITemplatePart>;

  constructor(initial: ITemplatePart[] = []) {
    this.store = initial.reduce((acc, p) => {
      acc[p.key] = p;
      return acc;
    }, {} as Record<string, ITemplatePart>);
  }

  public getAll(): ITemplatePart[] {
    return Object.values(this.store);
  }

  public getByKey(key: string): ITemplatePart | undefined {
    return this.store[key];
  }

  public upsert(item: ITemplatePart): void {
    this.store[item.key] = item;
  }

  public remove(key: string): void {
    delete this.store[key];
  }
}
