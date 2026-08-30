export type Result<T, E extends Error> =
  | {
      success: true
      data: T
    }
  | {
      success: false
      error: E
    }

export function Ok<T>(data: T): Result<T, never> {
  return {
    success: true,
    data,
  }
}

export function Err<E extends Error>(error: E): Result<never, E> {
  return {
    success: false,
    error,
  }
}
