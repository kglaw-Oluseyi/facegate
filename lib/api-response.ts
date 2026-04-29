export function jsonOk<T>(data: T, init?: ResponseInit) {
  return Response.json({ data, error: null }, init);
}

export function jsonErr(message: string, status = 400) {
  return Response.json({ data: null, error: message }, { status });
}
