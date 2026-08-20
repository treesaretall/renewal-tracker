import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { publicUserSchema, loginSchema, signupSchema } from "@renewal/shared";
import { keys } from "./keys";
import { request, requestVoid } from "./http";

/**
 * Fetch the current authenticated user.
 * retry: false so an anonymous visitor doesn't retry a 401 three times.
 */
export function useMe() {
  return useQuery({
    queryKey: keys.auth.me(),
    queryFn: ({ signal }) =>
      request("/api/auth/me", { schema: publicUserSchema, signal }),
    retry: false,
  });
}

/**
 * Login mutation.
 * Sets the me cache directly from the response and invalidates everything else.
 */
export function useLogin() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (credentials: { email: string; password: string }) =>
      request("/api/auth/login", {
        method: "POST",
        body: loginSchema.parse(credentials),
        schema: publicUserSchema,
      }),
    onSuccess: (user) => {
      // Set the me cache directly from the response
      queryClient.setQueryData(keys.auth.me(), user);
      // Invalidate everything else to refetch with the new user's context
      queryClient.invalidateQueries();
    },
  });
}

/**
 * Signup mutation.
 * Sets the me cache directly from the response and invalidates everything else.
 */
export function useSignup() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (credentials: { email: string; password: string }) =>
      request("/api/auth/signup", {
        method: "POST",
        body: signupSchema.parse(credentials),
        schema: publicUserSchema,
      }),
    onSuccess: (user) => {
      // Set the me cache directly from the response
      queryClient.setQueryData(keys.auth.me(), user);
      // Invalidate everything else to refetch with the new user's context
      queryClient.invalidateQueries();
    },
  });
}

/**
 * Logout mutation.
 * Calls queryClient.clear() to ensure no previous user's data can survive
 * a user switch. This is a security consideration, not just tidiness —
 * clearing the cache prevents one user from seeing another's data if they
 * log in on the same device.
 */
export function useLogout() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => requestVoid("/api/auth/logout", { method: "POST" }),
    onSuccess: () => {
      // Clear all query data to ensure no previous user's data survives.
      // This is critical for security: a cached item list, document, or
      // settings from user A must not leak to user B after logout + login.
      queryClient.clear();
    },
  });
}
