import { describe, it, expect } from "vitest";
import {
  signSession,
  verifySession,
  hashPassword,
  comparePassword,
} from "../session";

describe("Session Auth Helper", () => {
  const payload = {
    userId: "user-123",
    email: "test@example.com",
    role: "admin",
  };

  describe("JWT Session Token Management", () => {
    it("should successfully sign and verify a session token", async () => {
      const token = await signSession(payload, 3600);
      expect(token).toBeDefined();
      expect(typeof token).toBe("string");

      const decoded = await verifySession(token);
      expect(decoded).not.toBeNull();
      expect(decoded).toEqual(payload);
    });

    it("should return null for expired tokens", async () => {
      // Create a token that expires instantly (-10 seconds)
      const token = await signSession(payload, -10);
      const decoded = await verifySession(token);
      expect(decoded).toBeNull();
    });

    it("should return null for invalid or tampered tokens", async () => {
      const token = await signSession(payload, 3600);
      const tamperedToken = token + "modified";
      const decoded = await verifySession(tamperedToken);
      expect(decoded).toBeNull();
    });

    it("should return null for a completely random string", async () => {
      const decoded = await verifySession("not-a-token");
      expect(decoded).toBeNull();
    });
  });

  describe("Password Hashing", () => {
    it("should successfully hash a password and verify it", async () => {
      const password = "SuperSecretPassword123!";
      const hash = await hashPassword(password);

      expect(hash).toBeDefined();
      expect(typeof hash).toBe("string");
      expect(hash).not.toEqual(password);

      const isMatch = await comparePassword(password, hash);
      expect(isMatch).toBe(true);
    });

    it("should fail to verify a wrong password against a valid hash", async () => {
      const password = "SuperSecretPassword123!";
      const wrongPassword = "WrongPassword123!";
      const hash = await hashPassword(password);

      const isMatch = await comparePassword(wrongPassword, hash);
      expect(isMatch).toBe(false);
    });
  });
});
