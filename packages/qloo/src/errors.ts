/**
 * The closed error union of the Qloo adapter (ADR 0007, 0008). Messages are fixed or built from
 * our own constants and schema paths; an upstream body, header or URL never reaches a message.
 */
export type QlooErrorKind = "timeout" | "rate_limited" | "unavailable" | "shape" | "bad_request";

export class QlooError extends Error {
  readonly kind: QlooErrorKind;
  /** True when one retry is allowed (timeout, 429, 5xx). Never set from upstream text. */
  readonly retryable: boolean;

  constructor(kind: QlooErrorKind, message: string, retryable: boolean) {
    super(message);
    this.name = "QlooError";
    this.kind = kind;
    this.retryable = retryable;
  }
}

export class QlooTimeout extends QlooError {
  constructor() {
    super("timeout", "Qloo did not answer in time", true);
    this.name = "QlooTimeout";
  }
}

export class QlooRateLimited extends QlooError {
  constructor() {
    super("rate_limited", "Qloo is rate limiting requests", true);
    this.name = "QlooRateLimited";
  }
}

export class QlooUnavailable extends QlooError {
  constructor(message = "Qloo is unavailable", retryable = false) {
    super("unavailable", message, retryable);
    this.name = "QlooUnavailable";
  }
}

export class QlooShapeError extends QlooError {
  /** Schema paths that failed (our own field names, never upstream values). */
  readonly paths: readonly string[];

  constructor(endpoint: string, paths: readonly string[]) {
    super("shape", `Qloo ${endpoint} response did not match the expected shape at: ${paths.slice(0, 5).join(", ") || "(root)"}`, false);
    this.name = "QlooShapeError";
    this.paths = paths;
  }
}

export class QlooBadRequest extends QlooError {
  constructor(message = "Qloo rejected the request") {
    super("bad_request", message, false);
    this.name = "QlooBadRequest";
  }
}

/** Closed set of the thrown classes, for exhaustive handling by callers. */
export type QlooFailure = QlooTimeout | QlooRateLimited | QlooUnavailable | QlooShapeError | QlooBadRequest;
