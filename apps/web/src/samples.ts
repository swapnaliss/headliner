import { ChoiceSchema, CreateSlateRequestSchema, type Choice, type CreateSlateRequest, type Slate } from "@headliner/core";
import { createQlooClient, FixtureTransport, InMemoryCacheStore, type QlooClient } from "@headliner/qloo";
import { z } from "zod";
import roomsJson from "../samples/rooms.json";
import type { Runtime } from "./config";
import { initialCities } from "./cityStrengthView";
import { loadCityStrength } from "./pipeline/cityStrength";
import { confirmRun, createSlate } from "./pipeline/createSlate";
import { MemoryRunStore } from "./runStore";
import { isSampleId, SAMPLE_SLUG, sampleId } from "./sampleId";
import { MemorySlateStore, type SlateStore } from "./slateStore";

/**
 * Pre-warmed sample rooms (M2-06). A sample is a real room, chosen by a person, whose slate was
 * built once from real Qloo responses and stored pinned (see `scripts/prewarm-samples.ts`). Opening
 * one reads the stored slate: zero Qloo calls, zero budget. In `DEMO_MODE=fixtures` the same room
 * is rebuilt from `fixtures/qloo` on first open, so it works with no key and no database.
 */

export { isSampleId, sampleId };

export const SampleRoomSchema = z
  .object({
    slug: z.string().min(1).max(40).regex(SAMPLE_SLUG),
    /** What the button says with the city; descriptive, never a real venue's name. */
    venueName: z.string().min(1).max(60),
    city: CreateSlateRequestSchema.shape.city,
    crowdActs: CreateSlateRequestSchema.shape.crowdActs,
    candidateActs: CreateSlateRequestSchema.shape.candidateActs,
    /**
     * Pre-recorded confirmations for names that do not auto-resolve: typed name -> chosen Qloo
     * entity id (or "skip"). Empty when every name resolves to an exact top hit.
     */
    confirmations: z.record(z.string().min(1), ChoiceSchema.shape.entityId),
    /** Day the room's Qloo responses were recorded (YYYY-MM-DD); the prewarm script refreshes it. */
    recordedOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  })
  .strict();
export type SampleRoom = z.infer<typeof SampleRoomSchema>;

export const SampleRoomsSchema = z
  .array(SampleRoomSchema)
  .min(2)
  .max(3)
  .refine((rooms) => new Set(rooms.map((r) => r.slug)).size === rooms.length, "slugs must be unique");

/** The validated rooms file. Throws at first use when the file is invalid. */
export function loadSampleRooms(): readonly SampleRoom[] {
  return SampleRoomsSchema.parse(roomsJson);
}

export function findSampleRoom(id: string, rooms: readonly SampleRoom[] = loadSampleRooms()): SampleRoom | undefined {
  return isSampleId(id) ? rooms.find((r) => sampleId(r.slug) === id) : undefined;
}

export interface SampleLink {
  readonly slug: string;
  readonly venueName: string;
  readonly city: string;
  readonly href: string;
  readonly recordedOn: string;
}

/** What the intake screen lists. Plain strings from our own file. */
export function sampleLinks(rooms: readonly SampleRoom[] = loadSampleRooms()): SampleLink[] {
  return rooms.map((r) => ({ slug: r.slug, venueName: r.venueName, city: r.city, href: `/s/${sampleId(r.slug)}`, recordedOn: r.recordedOn }));
}

export function requestOf(room: SampleRoom): CreateSlateRequest {
  return { city: room.city, crowdActs: [...room.crowdActs], candidateActs: [...room.candidateActs] };
}

export interface SampleBuild {
  readonly slate: Slate;
  /** The act whose city strength was loaded (rank 1). */
  readonly topActId: string;
}

/**
 * Runs the full pipeline for one sample room through `client` (live adapter in the prewarm script,
 * the recorded fixtures in fixtures mode): match, confirm with the file's recorded confirmations,
 * compare, score, rank, then city strength for the top act and the comparison cities. Throws when
 * a name needs a confirmation the file does not hold, or when any candidate has no data: a sample
 * must be a complete, real run.
 */
export async function buildSampleSlate(room: SampleRoom, client: QlooClient, mode: Runtime["mode"], now: () => Date): Promise<SampleBuild> {
  const store = new MemorySlateStore();
  const rt: Runtime = { mode, client, store, runs: new MemoryRunStore(now), now };
  const id = sampleId(room.slug);

  let outcome = await createSlate(requestOf(room), rt);
  if (outcome.status === "awaiting_confirmation") {
    const choices: Choice[] = [];
    for (const m of outcome.matches) {
      if (m.state === "exact") continue;
      const chosen = room.confirmations[m.actInput];
      if (chosen === undefined) throw new Error(`sample ${room.slug}: "${m.actInput}" needs an entry in confirmations (${m.state})`);
      choices.push({ actInput: m.actInput, entityId: chosen });
    }
    outcome = await confirmRun(outcome.runId, choices, rt);
  }
  if (outcome.status !== "done") throw new Error(`sample ${room.slug}: unexpected outcome`);

  const unscored = outcome.slate.results.filter((r) => r.status !== "scored");
  if (unscored.length > 0) throw new Error(`sample ${room.slug}: no Qloo data for ${unscored.map((r) => r.act.name).join(", ")}`);
  const top = outcome.slate.results[0];
  if (!top) throw new Error(`sample ${room.slug}: empty slate`);

  await store.save({ ...outcome.slate, id });
  await loadCityStrength(rt, { slateId: id, actId: top.act.qlooEntityId, cities: initialCities(room.city), request: new Request("http://sample.invalid/") });
  const slate = await store.get(id);
  if (!slate) throw new Error(`sample ${room.slug}: slate lost`);
  return { slate, topActId: top.act.qlooEntityId };
}

/**
 * Fixtures mode: sample slates are rebuilt from the recordings on first open and held in memory.
 * Everything else is the plain in-memory store. The client here has its own clock (the recording
 * day), so the evidence shows when the responses were recorded, not today.
 */
export class FixtureSampleStore implements SlateStore {
  private readonly builds = new Map<string, Promise<void>>();
  constructor(
    private readonly inner: MemorySlateStore,
    private readonly fixtureDir: string,
    private readonly rooms: readonly SampleRoom[] = loadSampleRooms(),
  ) {}

  private async ensure(id: string): Promise<void> {
    const room = findSampleRoom(id, this.rooms);
    if (!room) return;
    let build = this.builds.get(id);
    if (!build) {
      const recordedAt = new Date(`${room.recordedOn}T12:00:00.000Z`);
      const client = createQlooClient({ transport: new FixtureTransport(this.fixtureDir), cache: new InMemoryCacheStore(), now: () => recordedAt });
      build = buildSampleSlate(room, client, "fixtures", () => recordedAt).then(async ({ slate }) => {
        await this.inner.save(slate);
      });
      this.builds.set(id, build);
      build.catch(() => this.builds.delete(id));
    }
    await build;
  }

  async get(id: string): Promise<Slate | null> {
    if (isSampleId(id)) {
      try {
        await this.ensure(id);
      } catch {
        return null;
      }
    }
    return this.inner.get(id);
  }
  save(slate: Slate): Promise<void> {
    return this.inner.save(slate);
  }
  update(slate: Slate): Promise<boolean> {
    return this.inner.update(slate);
  }
}
