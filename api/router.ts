import { actionPlanRouter } from "./action-plan-router";
import { alertsRouter } from "./alerts-router";
import { analyticsRouter } from "./analytics-router";
import { askRouter } from "./ask-router";
import { authRouter } from "./auth-router";
import { bootstrapRouter } from "./bootstrap-router";
import { citationsRouter } from "./citations-router";
import { competitorsRouter } from "./competitors-router";
import { connectRouter } from "./connect-router";
import { dashboardRouter } from "./dashboard-router";
import { hqRouter } from "./hq-router";
import { monitoringRouter } from "./monitoring-router";
import { reportRouter } from "./report-router";
import { settingsRouter } from "./settings-router";
import { createRouter, publicQuery } from "./middleware";

export const appRouter = createRouter({
  ping: publicQuery.query(() => ({ ok: true, ts: Date.now() })),
  auth: authRouter,
  bootstrap: bootstrapRouter,
  dashboard: dashboardRouter,
  monitoring: monitoringRouter,
  analytics: analyticsRouter,
  competitors: competitorsRouter,
  citations: citationsRouter,
  alerts: alertsRouter,
  actionPlan: actionPlanRouter,
  ask: askRouter,
  report: reportRouter,
  settings: settingsRouter,
  hq: hqRouter,
  connect: connectRouter,
});

export type AppRouter = typeof appRouter;
