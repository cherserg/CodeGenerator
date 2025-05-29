// src/repositories/entity.repository.ts
import { IGenericRepository } from "../interfaces/agents/repository.interface";
import { IEntity } from "../interfaces/entities/entity.interface";

export class EntityRepository implements IGenericRepository<IEntity, string> {
  private store: Record<string, IEntity>;

  constructor(initial: IEntity[] = []) {
    this.store = initial.reduce((acc, e) => {
      acc[e.name] = e;
      return acc;
    }, {} as Record<string, IEntity>);
  }

  public getAll(): IEntity[] {
    return Object.values(this.store);
  }

  public getByKey(key: string): IEntity | undefined {
    return this.store[key];
  }

  public upsert(item: IEntity): void {
    this.store[item.name] = item;
  }

  public remove(key: string): void {
    delete this.store[key];
  }
}
