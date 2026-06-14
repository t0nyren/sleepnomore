import * as Sentry from "@sentry/nextjs";

const dsn = process.env.MIANAN_SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.MIANAN_ENV || "production",
    tracesSampleRate: 0.1,
    debug: false,
  });
}
