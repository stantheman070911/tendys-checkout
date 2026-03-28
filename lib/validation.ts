import { NextResponse } from "next/server";
import { z } from "zod";

export { z };

export function errorResponse(
  error: string,
  init?: number | ResponseInit,
) {
  const responseInit =
    typeof init === "number" ? { status: init } : init;
  return NextResponse.json({ error }, responseInit);
}

export function getFirstZodErrorMessage(result: z.ZodError) {
  return result.issues[0]?.message ?? "Invalid request";
}

export async function parseJsonBody<TSchema extends z.ZodTypeAny>(
  request: Request,
  schema: TSchema,
) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return {
      success: false as const,
      response: errorResponse("Invalid JSON", 400),
    };
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return {
      success: false as const,
      response: errorResponse(getFirstZodErrorMessage(parsed.error), 400),
    };
  }

  return {
    success: true as const,
    data: parsed.data,
  };
}

export async function parseFormData<TSchema extends z.ZodTypeAny>(
  request: Request,
  schema: TSchema,
) {
  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return {
      success: false as const,
      response: errorResponse("Invalid form data", 400),
    };
  }

  const parsed = schema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) {
    return {
      success: false as const,
      response: errorResponse(getFirstZodErrorMessage(parsed.error), 400),
    };
  }

  return {
    success: true as const,
    data: parsed.data,
  };
}

export function parseSearchParams<TSchema extends z.ZodTypeAny>(
  searchParams: URLSearchParams,
  schema: TSchema,
) {
  const source: Record<string, string | string[]> = {};

  for (const key of new Set(searchParams.keys())) {
    const allValues = searchParams.getAll(key);
    source[key] = allValues.length > 1 ? allValues : (allValues[0] ?? "");
  }

  const parsed = schema.safeParse(source);
  if (!parsed.success) {
    return {
      success: false as const,
      response: errorResponse(getFirstZodErrorMessage(parsed.error), 400),
    };
  }

  return {
    success: true as const,
    data: parsed.data,
  };
}

export const uuidStringSchema = (field: string) =>
  z
    .string({ message: `${field} is required` })
    .trim()
    .uuid({ message: `${field} must be a valid UUID` });

export const optionalUuidStringSchema = (field: string) =>
  z
    .union([z.string(), z.null(), z.undefined()])
    .transform((value, context) => {
      if (typeof value !== "string") {
        return undefined;
      }

      const trimmed = value.trim();
      if (!trimmed) {
        return undefined;
      }

      const parsed = z.string().uuid().safeParse(trimmed);
      if (!parsed.success) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: `${field} must be a valid UUID`,
        });
        return z.NEVER;
      }

      return trimmed;
    });

export const requiredTrimmedStringSchema = (
  field: string,
  message = `${field} is required`,
) =>
  z
    .string({ message })
    .transform((value) => value.trim())
    .pipe(z.string().min(1, { message }));

export const optionalTrimmedStringSchema = () =>
  z
    .union([z.string(), z.null(), z.undefined()])
    .transform((value) => {
      if (typeof value !== "string") {
        return undefined;
      }

      const trimmed = value.trim();
      return trimmed ? trimmed : undefined;
    });

export const optionalNullableTrimmedStringSchema = () =>
  z
    .union([z.string(), z.null(), z.undefined()])
    .transform((value) => {
      if (value === null) {
        return null;
      }
      if (typeof value !== "string") {
        return undefined;
      }

      const trimmed = value.trim();
      return trimmed ? trimmed : null;
    });

export const positiveIntegerSchema = (field: string) =>
  z
    .number({ message: `${field} must be a positive integer` })
    .int(`${field} must be a positive integer`)
    .positive(`${field} must be a positive integer`);

export const nonNegativeIntegerOrNullSchema = (field: string) =>
  z
    .union([
      z.null(),
      z
        .number({ message: `${field} must be a non-negative integer or null` })
        .int(`${field} must be a non-negative integer or null`)
        .nonnegative(`${field} must be a non-negative integer or null`),
      z.undefined(),
    ])
    .transform((value) => (value === undefined ? undefined : value));
