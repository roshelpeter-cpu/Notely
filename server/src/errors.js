export class HttpError extends Error {
  constructor(status, message, extra = {}) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
    this.code = extra.code;
    this.details = extra.details;
    this.current = extra.current;
  }
}

export function isUniqueError(error) {
  return typeof error?.message === 'string' && error.message.includes('UNIQUE constraint failed');
}

export function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}
