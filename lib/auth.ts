// lib/auth.ts
import jwt from "jsonwebtoken";
import { cookies } from "next/headers";
import { NextRequest } from "next/server";
import { prisma } from "./prisma";
import type { Role, User } from "@prisma/client";

// Support multiple cookie names for different user types
export const AUTH_COOKIE_NAME = "auth_token";
export const ADMIN_COOKIE_NAME = "admin_token";
export const STAFF_COOKIE_NAME = "staff_token";

type JwtPayload = {
  userId: number;
  role: Role;
};

const JWT_SECRET = process.env.JWT_SECRET || "dev-secret";

/** Create a JWT for a user */
export function signAuthToken(user: { id: number; role: Role }) {
  const payload: JwtPayload = {
    userId: user.id,
    role: user.role,
  };

  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: "7d",
  });
}

/** Read the current user from a specific cookie (for Server Components) */
export async function getCurrentUserFromCookie(cookieName?: string): Promise<
  Pick<User, "id" | "email" | "fullName" | "role"> | null
> {
  try {
    const cookieStore = await cookies();
    
    // If a specific cookie name is provided, check it. Otherwise, check all valid ones.
    const cookiesToCheck = cookieName 
      ? [cookieName] 
      : [ADMIN_COOKIE_NAME, AUTH_COOKIE_NAME, STAFF_COOKIE_NAME];

    let token;
    for (const name of cookiesToCheck) {
      const val = cookieStore.get(name)?.value;
      if (val) {
        token = val;
        break; // Stop looking once we find a valid token
      }
    }

    if (!token) return null;

    const decoded = jwt.verify(token, JWT_SECRET) as JwtPayload;

    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: {
        id: true,
        email: true,
        fullName: true,
        role: true,
      },
    });

    return user;
  } catch (err) {
    return null;
  }
}

/** Read the current user checking all cookies by default */
export async function getCurrentUser(): Promise<
  Pick<User, "id" | "email" | "fullName" | "role"> | null
> {
  // Falls back to checking all cookies so Admins don't get 401s
  return getCurrentUserFromCookie(); 
}

/** Read the current admin user (checks admin_token) */
export async function getCurrentAdmin(): Promise<
  Pick<User, "id" | "email" | "fullName" | "role"> | null
> {
  return getCurrentUserFromCookie(ADMIN_COOKIE_NAME);
}

/** Verify token from API request, checking multiple cookies if no specific one is provided */
export function verifyTokenFromCookie(request: NextRequest, cookieName?: string): { id: number; role: Role } | null {
  try {
    // If a specific cookie is passed, check that. Otherwise, check all possible auth cookies.
    const cookiesToCheck = cookieName 
      ? [cookieName] 
      : [ADMIN_COOKIE_NAME, AUTH_COOKIE_NAME, STAFF_COOKIE_NAME];

    for (const name of cookiesToCheck) {
      const token = request.cookies.get(name)?.value;
      if (token) {
        // If we find a valid token, verify and return it immediately
        const decoded = jwt.verify(token, JWT_SECRET) as JwtPayload;
        return {
          id: decoded.userId,
          role: decoded.role,
        };
      }
    }
    
    return null; // No valid tokens found in any of the checked cookies
  } catch (err) {
    return null;
  }
}

/** Verify token checking all cookies (default) */
export function verifyToken(request: NextRequest): { id: number; role: Role } | null {
  return verifyTokenFromCookie(request);
}

/** Verify admin token (checks admin_token) */
export function verifyAdminToken(request: NextRequest): { id: number; role: Role } | null {
  return verifyTokenFromCookie(request, ADMIN_COOKIE_NAME);
}

/** Helper to require an authenticated user in a Server Component */
export async function requireAuth(cookieName?: string) {
  const user = await getCurrentUserFromCookie(cookieName);
  if (!user) {
    throw new Error("UNAUTHENTICATED");
  }
  return user;
}

/** Helper to require specific roles in a Server Component */
export async function requireRole(allowedRoles: Role[], cookieName?: string) {
  const user = await requireAuth(cookieName);
  if (!allowedRoles.includes(user.role)) {
    throw new Error("FORBIDDEN");
  }
  return user;
}

/** Helper to require specific roles in an API Route */
export function requireRoleApi(
  request: NextRequest,
  allowedRoles: Role[],
  cookieName?: string // Make this optional
): { id: number; role: Role } | null {
  const user = verifyTokenFromCookie(request, cookieName);
  if (!user) return null;
  if (!allowedRoles.includes(user.role)) return null;
  return user;
}

/** Simple utility to set a cookie with specific name */
export async function setAuthCookie(token: string, cookieName: string = AUTH_COOKIE_NAME) {
  const cookieStore = await cookies();
  cookieStore.set(cookieName, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 7 * 24 * 60 * 60, // 7 days
  });
}

/** Clear a specific cookie */
export async function clearAuthCookie(cookieName: string = AUTH_COOKIE_NAME) {
  const cookieStore = await cookies();
  cookieStore.set(cookieName, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
}

/** Clear all auth cookies (logout from everywhere) */
export async function clearAllAuthCookies() {
  await clearAuthCookie(AUTH_COOKIE_NAME);
  await clearAuthCookie(ADMIN_COOKIE_NAME);
  await clearAuthCookie(STAFF_COOKIE_NAME);
}