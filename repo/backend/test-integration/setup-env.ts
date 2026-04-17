// Integration-env: values here are used ONLY when the harness is run against
// a real MySQL (docker-compose `backend-integration` service). Production
// defaults would be overridden by container environment variables anyway.
process.env.NODE_ENV ??= "test";
process.env.DB_HOST ??= "db";
process.env.DB_PORT ??= "3306";
process.env.DB_USER ??= "appuser";
process.env.DB_PASSWORD ??= "apppassword";
process.env.DB_NAME ??= "neighborhoodpickup";
process.env.SESSION_SECRET ??= "docker-local-session-secret";
process.env.SESSION_TTL_HOURS ??= "12";
process.env.LOCKOUT_MAX_ATTEMPTS ??= "5";
process.env.LOCKOUT_MINUTES ??= "15";
process.env.FRONTEND_ORIGINS ??=
  "http://localhost:8081,http://frontend:80,http://backend:4000";
// Disable the scheduled retention interval so no timers leak across tests.
process.env.BEHAVIOR_RETENTION_RUN_INTERVAL_MINUTES ??= "0";
process.env.BEHAVIOR_BUFFER_FLUSH_INTERVAL_MS ??= "0";
