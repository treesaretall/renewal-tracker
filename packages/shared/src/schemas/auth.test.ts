import { describe, expect, it } from "vitest";
import {
  emailSchema,
  loginSchema,
  passwordSchema,
  publicUserSchema,
  signupSchema,
} from "./auth.js";

describe("emailSchema", () => {
  it("accepts valid email", () => {
    expect(emailSchema.parse("user@example.com")).toBe("user@example.com");
  });

  it("trims whitespace", () => {
    expect(emailSchema.parse("  user@example.com  ")).toBe("user@example.com");
  });

  it("lowercases email", () => {
    expect(emailSchema.parse("User@Example.COM")).toBe("user@example.com");
  });

  it("rejects invalid email format", () => {
    expect(() => emailSchema.parse("not-an-email")).toThrow();
    expect(() => emailSchema.parse("missing@domain")).toThrow();
    expect(() => emailSchema.parse("@example.com")).toThrow();
  });

  it("rejects email longer than 254 characters", () => {
    const longEmail = "a".repeat(250) + "@example.com";
    expect(() => emailSchema.parse(longEmail)).toThrow();
  });
});

describe("passwordSchema", () => {
  it("accepts valid password with letters and non-letters", () => {
    expect(passwordSchema.parse("password123!")).toBe("password123!");
    expect(passwordSchema.parse("coffee table 99")).toBe("coffee table 99");
    expect(passwordSchema.parse("MyP@ssw0rd12")).toBe("MyP@ssw0rd12");
  });

  it("rejects password shorter than 12 characters", () => {
    const result = passwordSchema.safeParse("short1!");
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toContain(
        "at least 12 characters",
      );
    }
  });

  it("rejects password longer than 200 characters", () => {
    const longPassword = "a".repeat(201);
    expect(() => passwordSchema.parse(longPassword)).toThrow();
  });

  it("rejects password with only letters", () => {
    const result = passwordSchema.safeParse("onlylettershere");
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toContain(
        "at least one letter and one non-letter",
      );
    }
  });

  it("rejects password with only non-letters", () => {
    const result = passwordSchema.safeParse("123456789012");
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toContain(
        "at least one letter and one non-letter",
      );
    }
  });

  it("accepts password with uppercase and lowercase letters", () => {
    expect(passwordSchema.parse("UpperLower123")).toBe("UpperLower123");
  });

  it("accepts password with special characters", () => {
    expect(passwordSchema.parse("p@ssw0rd!#$%")).toBe("p@ssw0rd!#$%");
  });

  it("accepts password with spaces", () => {
    expect(passwordSchema.parse("my password 123")).toBe("my password 123");
  });
});

describe("signupSchema", () => {
  it("accepts valid signup data", () => {
    const data = {
      email: "user@example.com",
      password: "securepassword123",
    };
    expect(signupSchema.parse(data)).toEqual(data);
  });

  it("normalizes email in signup", () => {
    const data = {
      email: "User@Example.COM",
      password: "securepassword123",
    };
    const parsed = signupSchema.parse(data);
    expect(parsed.email).toBe("user@example.com");
  });

  it("validates password requirements in signup", () => {
    const data = {
      email: "user@example.com",
      password: "short",
    };
    expect(() => signupSchema.parse(data)).toThrow();
  });
});

describe("loginSchema", () => {
  it("accepts valid login data", () => {
    const data = {
      email: "user@example.com",
      password: "securepassword123",
    };
    expect(loginSchema.parse(data)).toEqual(data);
  });

  it("normalizes email in login", () => {
    const data = {
      email: "User@Example.COM",
      password: "securepassword123",
    };
    const parsed = loginSchema.parse(data);
    expect(parsed.email).toBe("user@example.com");
  });
});

describe("publicUserSchema", () => {
  it("accepts valid public user data", () => {
    const user = {
      id: "clh123456",
      email: "user@example.com",
      createdAt: "2026-08-18T10:00:00.000Z",
    };
    expect(publicUserSchema.parse(user)).toEqual(user);
  });

  it("does not include passwordHash field", () => {
    const schema = publicUserSchema.shape;
    expect("passwordHash" in schema).toBe(false);
  });
});
