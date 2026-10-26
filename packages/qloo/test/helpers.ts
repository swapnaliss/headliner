import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import type { QlooTransport, TransportRequest, TransportResponse } from "../src/transport/types";

export const FIXTURE_DIR = resolve(__dirname, "../../../fixtures/qloo");

export function fixtureBody(file: string): unknown {
  return (JSON.parse(readFileSync(join(FIXTURE_DIR, file), "utf8")) as { body: unknown }).body;
}

/** Real entity ids from the recordings (Apparat's Berlin crowd of 6, Khruangbin, Radiohead). */
export const CROWD = [
  "DB342083-22F9-4B2D-B6F4-414AAF35F217",
  "36254E3F-20E4-4151-AC61-D753CA41F34A",
  "2E869AD9-26C3-42BC-BEDF-8C20FA178765",
  "CF0367C1-A537-47E7-9F4D-170AE1D1D6BB",
  "EC8C92D0-0FDC-4F08-848E-2CCAA4B73149",
  "20C1F23D-907B-42AA-B13C-F714142282CF",
];
export const KHRUANGBIN = "BAF6317A-DF94-4C90-92AE-63F86560C21B";
export const RADIOHEAD = "70CAE5BF-2F4C-445C-A3E5-4EDACFC3591C";

export type Handler = (req: TransportRequest, callNo: number) => Promise<TransportResponse> | TransportResponse;

export interface FakeTransport extends QlooTransport {
  readonly calls: TransportRequest[];
}

export function fakeTransport(handler: Handler): FakeTransport {
  const calls: TransportRequest[] = [];
  return {
    calls,
    async get(req) {
      calls.push(req);
      return handler(req, calls.length);
    },
  };
}

export const searchOk = (): TransportResponse => ({ status: 200, body: fixtureBody("search--apparat.json") });
