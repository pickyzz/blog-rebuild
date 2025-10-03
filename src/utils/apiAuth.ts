import type { APIRoute } from "astro";

/**
 * API Key Authentication utilities
 */

export interface AuthResult {
  success: boolean;
  error?: string;
  user?: {
    id: string;
    role: string;
  };
}

/**
 * Authenticate request using API key
 * Supports multiple authentication methods:
 * - Authorization: Bearer <token>
 * - X-API-Key header
 * - Query parameter (less secure, for development only)
 */
export function authenticateRequest(request: Request): AuthResult {
  const expectedKey = import.meta.env.API_SECRET_KEY;

  // If no API key is configured, authentication is disabled
  if (!expectedKey) {
    return {
      success: false,
      error: "API authentication not configured on server",
    };
  }

  // Try different authentication methods
  const providedKey = getApiKeyFromRequest(request);

  if (!providedKey) {
    return {
      success: false,
      error:
        "Missing API key. Provide via Authorization header, X-API-Key header, or api_key query parameter",
    };
  }

  if (providedKey !== expectedKey) {
    return {
      success: false,
      error: "Invalid API key",
    };
  }

  return {
    success: true,
    user: {
      id: "api_user",
      role: "admin",
    },
  };
}

/**
 * Extract API key from request using multiple methods
 */
function getApiKeyFromRequest(request: Request): string | null {
  // Method 1: Authorization header (most secure)
  const authHeader = request.headers.get("authorization");
  if (authHeader?.startsWith("Bearer ")) {
    return authHeader.substring(7); // Remove "Bearer " prefix
  }

  // Method 2: X-API-Key header
  const apiKeyHeader = request.headers.get("x-api-key");
  if (apiKeyHeader) {
    return apiKeyHeader;
  }

  // Method 3: Query parameter (least secure, development only)
  const url = new URL(request.url);
  const queryKey = url.searchParams.get("api_key");
  if (queryKey) {
    return queryKey;
  }

  return null;
}

/**
 * Create authenticated API route wrapper
 * Automatically handles authentication and returns 401 for unauthenticated requests
 */
export function withAuth(handler: APIRoute): APIRoute {
  return async context => {
    const auth = authenticateRequest(context.request);

    if (!auth.success) {
      return new Response(
        JSON.stringify({
          success: false,
          message: auth.error,
        }),
        {
          status: 401,
          headers: {
            "Content-Type": "application/json",
            "WWW-Authenticate": "Bearer",
          },
        }
      );
    }

    // Add user info to context if needed
    (context as any).user = auth.user;

    return handler(context);
  };
}

/**
 * Validate API key format (optional utility)
 * Can be used for additional validation beyond simple string comparison
 */
export function validateApiKeyFormat(key: string): boolean {
  // Basic validation: not empty, reasonable length
  return Boolean(key) && key.length >= 16 && key.length <= 256;
}

/**
 * Generate a secure random API key (utility for development)
 * Note: This is not cryptographically secure for production use
 */
export function generateApiKey(length: number = 32): string {
  const chars =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
  const array = new Uint8Array(length);
  crypto.getRandomValues(array);
  let result = "";
  for (let i = 0; i < length; i++) {
    result += chars.charAt(array[i] % chars.length);
  }
  return result;
}
