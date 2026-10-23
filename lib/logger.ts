import pino from "pino";

export const logger = pino({
  level:
    process.env.LOG_LEVEL ??
    (process.env.NODE_ENV === "production" ? "info" : "debug"),
  base: {
    service: "findmaids",
    environment: process.env.NODE_ENV ?? "development",
  },
  redact: {
    paths: [
      "req.headers.authorization",
      "req.headers.cookie",
      "headers.authorization",
      "headers.cookie",
      "password",
      "passwordHash",
      "token",
      "accessToken",
      "refreshToken",
      "email",
      "phone",
      "message",
      "body",
      "secret",
      "apiKey",
    ],
    censor: "[REDACTED]",
  },
});
