import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { env } from "../config/env.js";

type TokenPayload = { sub: string; type: "access" | "refresh"; exp: number; jti?: string };

const encode = (value: object | string) =>
  Buffer.from(typeof value === "string" ? value : JSON.stringify(value)).toString("base64url");
const sign = (input: string, secret: string) =>
  createHmac("sha256", secret).update(input).digest("base64url");
export const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

export function createToken(userId: string, type: TokenPayload["type"]): string {
  const payload: TokenPayload = {
    sub: userId,
    type,
    exp:
      Math.floor(Date.now() / 1000) +
      (type === "access" ? env.ACCESS_TOKEN_MINUTES * 60 : env.REFRESH_TOKEN_DAYS * 86400),
    jti: type === "refresh" ? randomBytes(16).toString("hex") : undefined
  };
  const header = encode({ alg: "HS256", typ: "JWT" });
  const body = encode(payload);
  return `${header}.${body}.${sign(`${header}.${body}`, type === "access" ? env.ACCESS_TOKEN_SECRET : env.REFRESH_TOKEN_SECRET)}`;
}

export function verifyToken(
  token: string,
  expectedType: TokenPayload["type"]
): TokenPayload | null {
  try {
    const [header, body, signature] = token.split(".");
    if (!header || !body || !signature) return null;
    const expected = sign(
      `${header}.${body}`,
      expectedType === "access" ? env.ACCESS_TOKEN_SECRET : env.REFRESH_TOKEN_SECRET
    );
    if (!timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return null;
    const payload = JSON.parse(Buffer.from(body, "base64url").toString()) as TokenPayload;
    return payload.type === expectedType && payload.exp > Math.floor(Date.now() / 1000)
      ? payload
      : null;
  } catch {
    return null;
  }
}
