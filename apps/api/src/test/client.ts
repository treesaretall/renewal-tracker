import request from "supertest";
import type { User } from "../../generated/prisma/client.js";
import { createApp } from "../app.js";
import { createSession, SESSION_COOKIE_NAME } from "../auth/session.js";

export interface TestClient extends ReturnType<typeof request> {
  asUser: (user: User) => AuthenticatedTestClient;
}

export interface AuthenticatedTestClient {
  get: (url: string) => Promise<request.Response>;
  post: (url: string) => Promise<request.Response>;
  put: (url: string) => Promise<request.Response>;
  patch: (url: string) => Promise<request.Response>;
  delete: (url: string) => Promise<request.Response>;
}

export function buildTestClient(): TestClient {
  const agent = request(createApp()) as TestClient;

  agent.asUser = (user: User): AuthenticatedTestClient => {
    const makeAuthenticatedRequest = async (
      method: 'get' | 'post' | 'put' | 'patch' | 'delete',
      url: string,
    ) => {
      const { token } = await createSession(user.id);
      return agent[method](url).set('Cookie', `${SESSION_COOKIE_NAME}=${token}`);
    };

    return {
      get: (url) => makeAuthenticatedRequest('get', url),
      post: (url) => makeAuthenticatedRequest('post', url),
      put: (url) => makeAuthenticatedRequest('put', url),
      patch: (url) => makeAuthenticatedRequest('patch', url),
      delete: (url) => makeAuthenticatedRequest('delete', url),
    };
  };

  return agent;
}
