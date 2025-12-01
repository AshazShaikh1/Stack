import { NextResponse } from 'next/server';

/**
 * Standard API error responses
 */
export function unauthorized(message = 'Unauthorized') {
  return NextResponse.json({ error: message }, { status: 401 });
}

export function forbidden(message = 'Forbidden') {
  return NextResponse.json({ error: message }, { status: 403 });
}

export function notFound(message = 'Not found') {
  return NextResponse.json({ error: message }, { status: 404 });
}

export function badRequest(message = 'Bad request') {
  return NextResponse.json({ error: message }, { status: 400 });
}

export function internalError(message = 'Internal server error', error?: unknown) {
  if (error) {
    console.error('API Error:', error);
  }
  return NextResponse.json({ error: message }, { status: 500 });
}

export function conflict(message = 'Conflict') {
  return NextResponse.json({ error: message }, { status: 409 });
}

