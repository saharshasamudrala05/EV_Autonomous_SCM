export interface IStorage {
  // We don't persist runs in this memory-only MVP.
}

export class MemStorage implements IStorage {
  constructor() {}
}

export const storage = new MemStorage();
