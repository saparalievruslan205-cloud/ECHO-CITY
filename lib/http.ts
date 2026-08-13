import { ZodError } from "zod";

export function jsonError(error: unknown) {
  if (error instanceof Response) return error;
  if (error instanceof ZodError) {
    return Response.json({ error: "Некорректные данные", issues: error.issues }, { status: 400 });
  }
  const message = error instanceof Error ? error.message : "Неизвестная ошибка";
  return Response.json({ error: message }, { status: 500 });
}

