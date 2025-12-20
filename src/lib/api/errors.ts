import { NextResponse } from "next/server";
import { logger } from "@/lib/logger"; // <--- Import Logger

/**
 * Standard API error responses
 */
export function unauthorized(message = "Unauthorized") {
  return NextResponse.json({ error: message }, { status: 401 });
}

export function forbidden(message = "Forbidden") {
  return NextResponse.json({ error: message }, { status: 403 });
}

export function notFound(message = "Not found") {
  return NextResponse.json({ error: message }, { status: 404 });
}

export function badRequest(message = "Bad request") {
  return NextResponse.json({ error: message }, { status: 400 });
}

export function conflict(message = "Conflict") {
  return NextResponse.json({ error: message }, { status: 409 });
}

export function internalError(
  message = "Internal server error",
  error?: unknown
) {
  // <--- Log critical server errors automatically
  logger.error("API Internal Error", error, { publicMessage: message });

  return NextResponse.json({ error: message }, { status: 500 });
}
