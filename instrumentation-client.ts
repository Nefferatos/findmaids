import * as Sentry from "@sentry/nextjs";

if (process.env.NEXT_PUBLIC_SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
    environment: process.env.NODE_ENV,
    tracesSampleRate: Number(
      process.env.NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE ?? 0.05,
    ),
    sendDefaultPii: false,
    beforeSend(event) {
      if (event.user) event.user = { id: event.user.id };
      if (event.request) {
        delete event.request.data;
        delete event.request.cookies;
        event.request.headers = {};
      }
      return event;
    },
  });
}
