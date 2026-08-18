import request from "supertest";
import type { User } from "../../generated/prisma/client.js";
import { createApp } from "../app.js";

export interface TestClient extends ReturnType<typeof request> {
  asUser: (user: User) => TestClient;
}

export function buildTestClient(): TestClient {
  const agent = request(createApp()) as TestClient;

  // Stub for Phase 4: will attach a valid session cookie
  agent.asUser = (_user: User) => {
    // TODO: Create session in DB and attach cookie
    return agent;
  };

  return agent;
}
