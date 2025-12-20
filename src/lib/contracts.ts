/**
 * 8.3 — CONTRACTS
 * These are the non-negotiable shapes that all Services/Adapters must return.
 * This decouples the "What" (Data) from the "How" (Backend).
 */

// --- 1. ERROR SHAPE ---
export type ErrorCode = 
  | 'NOT_FOUND' 
  | 'UNAUTHORIZED' 
  | 'FORBIDDEN' 
  | 'VALIDATION_ERROR' 
  | 'CONFLICT' 
  | 'INTERNAL_ERROR';

export interface AppError {
  code: ErrorCode;
  message: string;
  details?: Record<string, any>; // Optional field for validation errors e.g. { email: "Invalid" }
}

// --- 2. OUTPUT SHAPE (The Result Pattern) ---
// Forces you to handle errors explicitly. No more try/catch hell in components.
export type Result<T> = 
  | { success: true; data: T; error: null }
  | { success: false; data: null; error: AppError };

// Helper to create success response
export function ok<T>(data: T): Result<T> {
  return { success: true, data, error: null };
}

// Helper to create error response
export function err(code: ErrorCode, message: string, details?: Record<string, any>): Result<any> {
  return { 
    success: false, 
    data: null, 
    error: { code, message, details } 
  };
}

// --- 3. INPUT SHAPES (Standardized) ---
export interface PaginationInput {
  page?: number;
  limit?: number;
  cursor?: string;
}

export interface PaginatedResult<T> {
  items: T[];
  total: number;
  hasMore: boolean;
  nextCursor?: string;
}