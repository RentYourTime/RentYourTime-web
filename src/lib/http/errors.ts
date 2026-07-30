/**
 * Central error catalogue for /api/v1. Every route throws (or returns) one
 * of these instead of building its own status code + body, so the HTTP
 * status for a given error code can never drift between endpoints.
 *
 * The `message` on each code is the *default* — always safe to show a user,
 * never a stack trace, SQL fragment, file path, or raw exception message
 * (see docs/API_ARCHITECTURE.md "Error handling").
 */
export const ERROR_CODES = {
  VALIDATION_ERROR: { status: 422, message: "Nie udało się przetworzyć żądania." },
  UNAUTHORIZED: { status: 401, message: "Uwierzytelnienie jest wymagane." },
  INVALID_CREDENTIALS: { status: 401, message: "Nieprawidłowy e-mail lub hasło." },
  TOKEN_EXPIRED: { status: 401, message: "Sesja wygasła. Zaloguj się ponownie." },
  TOKEN_INVALID: { status: 401, message: "Nieprawidłowy lub odwołany token." },
  TOKEN_REUSE_DETECTED: { status: 401, message: "Wykryto ponowne użycie tokenu. Wszystkie sesje zostały unieważnione." },
  FORBIDDEN: { status: 403, message: "Brak uprawnień do wykonania tej operacji." },
  NOT_FOUND: { status: 404, message: "Nie znaleziono zasobu." },
  DEVICE_NOT_FOUND: { status: 404, message: "Nie znaleziono urządzenia." },
  CONFLICT: { status: 409, message: "Zasób już istnieje lub jest w konflikcie." },
  EMAIL_TAKEN: { status: 409, message: "Konto z tym adresem e-mail już istnieje." },
  VERSION_CONFLICT: { status: 409, message: "Zasób został zmieniony przez inne urządzenie. Pobierz najnowszą wersję." },
  PAYLOAD_TOO_LARGE: { status: 413, message: "Treść żądania jest za duża." },
  UNSUPPORTED_MEDIA_TYPE: { status: 415, message: "Nieobsługiwany typ treści żądania." },
  IDEMPOTENCY_KEY_REUSED: { status: 422, message: "Ten sam Idempotency-Key został użyty z inną treścią żądania." },
  RATE_LIMITED: { status: 429, message: "Zbyt wiele żądań. Spróbuj ponownie później." },
  SERVER_ERROR: { status: 500, message: "Wystąpił nieoczekiwany błąd serwera." },
  NOT_IMPLEMENTED: { status: 501, message: "Ta funkcja nie jest jeszcze dostępna." },
  SERVICE_UNAVAILABLE: { status: 503, message: "Usługa jest tymczasowo niedostępna." },
  MAINTENANCE: { status: 503, message: "Trwa przerwa techniczna. Spróbuj ponownie za chwilę." },
} as const;

export type ErrorCode = keyof typeof ERROR_CODES;

export class ApiError extends Error {
  readonly code: ErrorCode;
  readonly status: number;
  readonly fields?: Record<string, string>;
  readonly headers?: Record<string, string>;

  constructor(code: ErrorCode, message?: string, fields?: Record<string, string>, headers?: Record<string, string>) {
    const spec = ERROR_CODES[code];
    super(message ?? spec.message);
    this.name = "ApiError";
    this.code = code;
    this.status = spec.status;
    this.fields = fields;
    this.headers = headers;
  }
}

export function validationError(fields: Record<string, string>, message?: string): ApiError {
  return new ApiError("VALIDATION_ERROR", message, fields);
}
