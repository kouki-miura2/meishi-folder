export type ServiceErrorCode = 'not_found' | 'conflict' | 'invalid'

/** A business-rule outcome raised by a service. The route layer maps `code` to an HTTP status; services know nothing about HTTP. */
export class ServiceError extends Error {
  readonly code: ServiceErrorCode

  constructor(code: ServiceErrorCode, message: string) {
    super(message)
    this.name = 'ServiceError'
    this.code = code
  }
}
