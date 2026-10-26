import { deleteRun, getRunJson, putRunJson, RUN_TTL_MS, type Db } from "@headliner/slates";
import { RunSchema, type Run } from "@headliner/core";

/** Pending runs (awaiting match confirmation). A confirm request may only pick from what is stored here. */
export interface RunStore {
  save(run: Run): Promise<void>;
  /** The run for a valid id, or null when unknown or expired. */
  get(id: string): Promise<Run | null>;
  /** Remove a run once it has been turned into a slate, so a confirm cannot be replayed. */
  remove(id: string): Promise<void>;
}

/** Fixtures mode: held in process memory, no database. */
export class MemoryRunStore implements RunStore {
  private readonly items = new Map<string, { run: Run; expires: number }>();
  constructor(private readonly now: () => Date = () => new Date()) {}
  async save(run: Run): Promise<void> {
    this.items.set(run.id, { run, expires: this.now().getTime() + RUN_TTL_MS });
  }
  async get(id: string): Promise<Run | null> {
    const item = this.items.get(id);
    if (!item || item.expires <= this.now().getTime()) return null;
    return item.run;
  }
  async remove(id: string): Promise<void> {
    this.items.delete(id);
  }
}

/** Live mode: the `runs` table. */
export class PostgresRunStore implements RunStore {
  constructor(
    private readonly db: Db,
    private readonly now: () => Date = () => new Date(),
  ) {}
  async save(run: Run): Promise<void> {
    await putRunJson(this.db, run.id, run, this.now());
  }
  async get(id: string): Promise<Run | null> {
    const json = await getRunJson(this.db, id, this.now());
    if (json === null) return null;
    const parsed = RunSchema.safeParse(json);
    return parsed.success ? parsed.data : null;
  }
  async remove(id: string): Promise<void> {
    await deleteRun(this.db, id);
  }
}
