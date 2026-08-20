import request from "supertest";
import type { User } from "../../generated/prisma/client.js";
import { createApp } from "../app.js";
import { createSession, SESSION_COOKIE_NAME } from "../auth/session.js";

export interface TestClient extends ReturnType<typeof request> {
  asUser: (user: User) => AuthenticatedTestClient;
}

export interface AuthenticatedTestClient {
  get: (url: string) => Promise<request.Response>;
  post: (url: string) => {
    send: (body: any) => Promise<request.Response>;
    attach: (field: string, file: Buffer, filename: string) => Promise<request.Response>;
  };
  put: (url: string) => {
    send: (body: any) => Promise<request.Response>;
  };
  patch: (url: string) => {
    send: (body: any) => Promise<request.Response>;
  };
  delete: (url: string) => Promise<request.Response>;
}

export function buildTestClient(): TestClient {
  const agent = request(createApp()) as TestClient;

  agent.asUser = (user: User): AuthenticatedTestClient => {
    const makeAuthenticatedRequest = async (
      method: 'get' | 'post' | 'put' | 'patch' | 'delete',
      url: string,
      body?: any,
    ) => {
      const { token } = await createSession(user.id);
      const req = agent[method](url).set('Cookie', `${SESSION_COOKIE_NAME}=${token}`);
      if (body !== undefined && (method === 'post' || method === 'put' || method === 'patch')) {
        return req.send(body);
      }
      return req;
    };

    return {
      get: (url) => makeAuthenticatedRequest('get', url),
      post: (url) => ({
        send: (body) => makeAuthenticatedRequest('post', url, body),
        attach: async (field: string, file: Buffer, filename: string) => {
          const { token } = await createSession(user.id);
          return agent
            .post(url)
            .set('Cookie', `${SESSION_COOKIE_NAME}=${token}`)
            .attach(field, file, filename);
        },
      }),
      put: (url) => ({
        send: (body) => makeAuthenticatedRequest('put', url, body),
      }),
      patch: (url) => ({
        send: (body) => makeAuthenticatedRequest('patch', url, body),
      }),
      delete: (url) => makeAuthenticatedRequest('delete', url),
    };
  };

  return agent;
}
