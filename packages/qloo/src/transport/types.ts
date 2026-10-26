/** What the client asks of a transport. `signal` aborts the request (timeout). */
export interface TransportRequest {
  readonly endpoint: string;
  readonly params: URLSearchParams;
  readonly signal: AbortSignal;
}

/** The raw upstream outcome. The body is untrusted JSON (or undefined when it was not JSON). */
export interface TransportResponse {
  readonly status: number;
  readonly body: unknown;
}

/** The seam between the adapter and the network. The pipeline cannot tell live from fixtures. */
export interface QlooTransport {
  get(req: TransportRequest): Promise<TransportResponse>;
}
