/**
 * File: src/pages/plan/Plan.tsx
 * Subscription Setting page: shows available plans with feature comparison and
 * a Monthly/Yearly billing toggle.
 *
 * Data loaded from the backend:
 *   GET /subscription/plans?page=&limit=  -> { pagination, data: ApiPlan[] }
 *
 * Actions:
 *   Free plan  -> POST /subscription/subscribe   body: { plan, period }
 *   Paid plan  -> POST /subscription/checkout     body: { planId, billing_cycle,
 *                   successUrl, cancelUrl } -> returns a hosted-checkout URL we
 *                   redirect the browser to.
 *   Trial      -> POST /subscription/start-trial  body: { planId }
 *
 * The feature-comparison rows are derived from the union of every plan's
 * `modules` array, so the grid reflects whatever the backend returns.
 */

import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  Check,
  X,
  Clock,
  ChevronRight,
  Loader2,
} from "lucide-react";
import { api } from "../../lib/api/client";
import { alertApiError, alertSuccess } from "../../utils/alert";
import Swal from "../../utils/alert";

/* ---------- Types ---------- */
interface PlanFeature {
  value: string;
  label: string;
}

/** Normalized plan used by the UI. */
interface Plan {
  id: string;
  name: string; // identifier used by subscribe / start-trial actions
  label: string; // display name
  description: string;
  monthlyPrice: number;
  yearlyPrice: number;
  isFree: boolean;
  users: number;
  trialDays: number; // 0 when the plan has no trial
  modules: string[];
}

/** Raw plan shape from GET /subscription/plans -> data[]. */
interface ApiPlan {
  _id: string;
  name: string;
  description: string;
  price_monthly: number;
  price_yearly: number;
  free_plan: boolean;
  trial: boolean;
  trial_days: number;
  status: boolean;
  number_of_users: number;
  modules: string[];
  limits: Record<string, unknown>;
  createdAt: string;
}

/** Pagination envelope shared by the list endpoints. */
interface Pagination {
  totalPage: number;
  currentPage: number;
  prevPage: number;
  nextPage: number;
  totalData: number;
}

interface PlansResponse {
  pagination: Pagination;
  data: ApiPlan[];
}

/** data payload of POST /subscription/checkout (envelope unwrapped by the api client). */
interface CheckoutResponse {
  url: string; // hosted Stripe checkout URL to redirect to
  sessionId?: string;
}

/* ---------- Helpers ---------- */
/** Pretty labels for module slugs; known acronyms stay uppercase. */
const MODULE_LABELS: Record<string, string> = {
  hrm: "HRM",
  crm: "CRM",
  pos: "POS",
};
const formatModule = (value: string): string =>
  MODULE_LABELS[value] ??
  value
    .split(/[-_]/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");

/** Map a raw API plan to the UI model. */
const mapPlan = (p: ApiPlan): Plan => ({
  id: p._id,
  name: p.name,
  label: p.name,
  description: p.description,
  monthlyPrice: p.price_monthly,
  yearlyPrice: p.price_yearly,
  isFree: p.free_plan,
  users: p.number_of_users,
  trialDays: typeof p.trial_days === "number" ? p.trial_days : 0,
  modules: Array.isArray(p.modules) ? p.modules : [],
});

const PAGE_SIZE = 10;

/* ===================================================================== */
/*                       SUBSCRIPTION SETTING                            */
/* ===================================================================== */
export const Plan: React.FC = () => {
  const [period, setPeriod] = useState<"monthly" | "yearly">("monthly");

  // ── Plans from the backend ───────────────────────────────────────────────
  const [plans, setPlans] = useState<Plan[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionPlan, setActionPlan] = useState<string | null>(null); // plan currently being acted on
  const [currentPlan, setCurrentPlan] = useState<{
    id: string;
    name: string;
    trial: boolean;
    expired: boolean;
    cancelAtPeriodEnd: boolean;
    endDate: string | null;
  } | null>(null);

  // Load one page of plans. Uses api.raw so we can read the pagination envelope
  // (api.get unwraps only the `data` field).
  const loadPlans = useCallback(async (targetPage: number) => {
    setLoading(true);
    setLoadError(null);
    try {
      const res = await api.raw.get("/subscription/plans", {
        params: { page: targetPage, limit: PAGE_SIZE },
      });
      const body = res.data as PlansResponse;
      setPlans(Array.isArray(body?.data) ? body.data.map(mapPlan) : []);
      setPagination(body?.pagination ?? null);
    } catch (err) {
      setLoadError("Couldn't load subscription plans. Please try again.");
      alertApiError(err, "Couldn't load subscription plans.");
    } finally {
      setLoading(false);
    }
  }, []);

  const loadCurrentPlan = useCallback(async () => {
    try {
      const sub = await api.get<any>("/subscription/my-subscription");
      if (sub && sub.exists !== false && (sub.plan_name || sub.plan_id)) {
        const expired = !!sub.expired;
        const cancelAtPeriodEnd =
          !!sub.cancel_at_period_end || sub.auto_renew === false || sub.status === "cancelled";
        setCurrentPlan({
          id: String(sub.plan_id || sub._id || ""),
          name: String(sub.plan_name || "Premium").trim() || "Premium",
          trial: !!sub.is_trial,
          expired,
          cancelAtPeriodEnd: cancelAtPeriodEnd && !expired,
          endDate: sub.end_date ? String(sub.end_date) : null,
        });
      } else {
        setCurrentPlan(null);
      }
    } catch {
      setCurrentPlan(null);
    }
  }, []);

  // (Re)load plans whenever the page changes.
  useEffect(() => {
    loadPlans(page);
  }, [page, loadPlans]);

  useEffect(() => {
    void loadCurrentPlan();
  }, [loadCurrentPlan]);

  // ── Actions ──────────────────────────────────────────────────────────────
  const handleSubscribe = async (plan: Plan) => {
    setActionPlan(plan.name);
    try {
      // Free plans are activated directly; paid plans go through hosted checkout.
      if (plan.isFree) {
        await api.post("/subscription/assign-free", {
          planId: plan.id,
          billing_cycle: period,
        });
        await alertSuccess("Free plan activated successfully.");
        await loadCurrentPlan();
        return;
      }

      const origin = window.location.origin;
      const res = await api.post<CheckoutResponse>("/subscription/checkout", {
        planId: plan.id,
        billing_cycle: period,
        successUrl: `${origin}/checkout/success`,
        cancelUrl: `${origin}/checkout/cancel`,
      });

      if (res?.url) {
        // Redirect to Stripe's hosted checkout page.
        window.location.href = res.url;
      } else {
        alertApiError(
          new Error("No checkout URL was returned."),
          "Couldn't start checkout.",
        );
      }
    } catch (err) {
      alertApiError(err, "Couldn't start checkout.");
    } finally {
      setActionPlan(null);
    }
  };

  const handleStartTrial = async (plan: Plan) => {
    setActionPlan(plan.name);
    try {
      await api.post("/subscription/start-trial", { planId: plan.id });
      await alertSuccess("Trial started successfully.");
      await loadCurrentPlan();
    } catch (err) {
      alertApiError(err, "Couldn't start trial.");
    } finally {
      setActionPlan(null);
    }
  };

  const handleCancelSubscription = async () => {
    if (!currentPlan || currentPlan.expired || currentPlan.cancelAtPeriodEnd) return;
    const endLabel = currentPlan.endDate
      ? new Date(currentPlan.endDate).toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          year: "numeric",
        })
      : "the end of the current period";
    const result = await Swal.fire({
      icon: "warning",
      title: "Cancel subscription?",
      html: `Auto-renew will stop. You'll keep access to <b>${currentPlan.name}</b> until <b>${endLabel}</b>.`,
      showCancelButton: true,
      confirmButtonText: "Yes, cancel renew",
      cancelButtonText: "Keep plan",
      confirmButtonColor: "#dc2626",
    });
    if (!result.isConfirmed) return;
    setActionPlan("__cancel__");
    try {
      await api.post("/subscription/cancel");
      await alertSuccess("Subscription cancelled. You keep access until the current period ends.");
      await loadCurrentPlan();
      window.dispatchEvent(new Event("qayd:subscription-changed"));
    } catch (err) {
      alertApiError(err, "Couldn't cancel subscription.");
    } finally {
      setActionPlan(null);
    }
  };

  const isCurrentPlan = (plan: Plan) => {
    if (!currentPlan) return false;
    if (currentPlan.id && (currentPlan.id === plan.id || currentPlan.id === plan.name)) return true;
    return currentPlan.name.toLowerCase() === plan.name.toLowerCase()
      || currentPlan.name.toLowerCase() === plan.label.toLowerCase();
  };

  // ── Helpers ──────────────────────────────────────────────────────────────
  // Feature-comparison rows: the union of every plan's modules on this page.
  const features: PlanFeature[] = useMemo(() => {
    const values = new Set<string>();
    plans.forEach((p) => p.modules.forEach((m) => values.add(m)));
    return Array.from(values)
      .sort()
      .map((value) => ({ value, label: formatModule(value) }));
  }, [plans]);

  const enabledCount = (plan: Plan) =>
    features.filter((f) => plan.modules.includes(f.value)).length;

  // Build grid template so it scales with the number of plans returned by the API.
  const gridCols = {
    gridTemplateColumns: `minmax(0,1fr) repeat(${Math.max(plans.length, 1)}, minmax(0,1fr))`,
  };

  return (
    <div className="module-page-shell !p-0 overflow-hidden flex flex-col">
      <div className="dashboard-title-bar shrink-0 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-lg font-semibold text-gray-900">Subscription Plans</h1>
            {currentPlan && (
              <span
                className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${
                  currentPlan.expired
                    ? "bg-red-100 text-red-700"
                    : currentPlan.cancelAtPeriodEnd
                      ? "bg-amber-100 text-amber-800"
                      : currentPlan.trial
                        ? "bg-amber-100 text-amber-800"
                        : "bg-blue-100 text-blue-700"
                }`}
                title={
                  currentPlan.expired
                    ? "Your plan has expired"
                    : currentPlan.cancelAtPeriodEnd
                      ? "Auto-renew cancelled — access until period end"
                      : currentPlan.trial
                        ? "You are on a trial plan"
                        : "Your active purchased plan"
                }
              >
                {currentPlan.name}
                {currentPlan.trial && !currentPlan.expired ? " · Trial" : ""}
                {currentPlan.expired
                  ? " · Expired"
                  : currentPlan.cancelAtPeriodEnd
                    ? " · Cancelling"
                    : " · Current"}
              </span>
            )}
          </div>
          <p className="text-xs text-gray-500 mt-0.5">
            {currentPlan && !currentPlan.expired
              ? currentPlan.cancelAtPeriodEnd
                ? `Auto-renew is off. Access until ${
                    currentPlan.endDate
                      ? new Date(currentPlan.endDate).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })
                      : "period end"
                  }.`
                : `You're on ${currentPlan.name}${currentPlan.trial ? " (trial)" : ""}. Upgrade or switch anytime.`
              : "Choose the plan that fits your team"}
          </p>
        </div>
        <div className="flex items-center gap-2 self-start sm:self-auto flex-wrap">
          {currentPlan && !currentPlan.expired && !currentPlan.cancelAtPeriodEnd && (
            <button
              type="button"
              onClick={() => void handleCancelSubscription()}
              disabled={actionPlan === "__cancel__"}
              className="px-3 py-1.5 text-sm rounded-md border border-red-200 text-red-700 bg-red-50 hover:bg-red-100 disabled:opacity-50"
            >
              {actionPlan === "__cancel__" ? "Cancelling…" : "Cancel subscription"}
            </button>
          )}
          <div className="inline-flex p-1 bg-white border border-gray-300 rounded-lg">
          <button
            type="button"
            onClick={() => setPeriod("monthly")}
            className={`px-5 py-1.5 text-sm rounded-md transition-colors ${
              period === "monthly"
                ? "bg-blue-600 text-white"
                : "text-gray-600 hover:text-gray-900"
            }`}
          >
            Monthly
          </button>
          <button
            type="button"
            onClick={() => setPeriod("yearly")}
            className={`px-5 py-1.5 text-sm rounded-md transition-colors ${
              period === "yearly"
                ? "bg-blue-600 text-white"
                : "text-gray-600 hover:text-gray-900"
            }`}
          >
            Yearly
          </button>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 md:p-6">
        <div className="max-w-[1600px] mx-auto">
        {/* Loading / error / empty */}
        {loading ? (
          <div className="bg-white rounded-xl shadow-sm border border-gray-300 p-16 flex items-center justify-center gap-2 text-gray-500">
            <Loader2 className="w-5 h-5 animate-spin" />
            <span className="text-sm">Loading plans…</span>
          </div>
        ) : loadError ? (
          <div className="bg-white rounded-xl shadow-sm border border-gray-300 p-12 text-sm text-red-600 text-center">
            {loadError}
          </div>
        ) : plans.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm border border-gray-300 p-12 text-sm text-gray-500 text-center">
            No plans available.
          </div>
        ) : (
          <>
            {/* Top row: Plan summary cards */}
            <div className="grid gap-4 mb-4" style={gridCols}>
              {/* Features label card */}
              <div className="bg-gray-100 border border-gray-300 rounded-xl flex items-center justify-center min-h-[230px]">
                <div className="text-lg font-semibold text-gray-700">Features</div>
              </div>

              {plans.map((plan) => {
                const price =
                  period === "monthly" ? plan.monthlyPrice : plan.yearlyPrice;
                const current = isCurrentPlan(plan);
                return (
                  <div
                    key={plan.name}
                    className={`relative bg-white rounded-xl shadow-sm flex flex-col items-center pt-8 pb-5 px-5 min-h-[230px] border ${
                      current ? "border-blue-500 ring-1 ring-blue-500/30" : "border-gray-300"
                    }`}
                  >
                    {current && (
                      <span
                        className={`absolute top-3 right-3 inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                          currentPlan?.expired
                            ? "bg-red-100 text-red-700"
                            : currentPlan?.trial
                              ? "bg-amber-100 text-amber-800"
                              : "bg-blue-600 text-white"
                        }`}
                      >
                        {currentPlan?.expired
                          ? "Expired"
                          : currentPlan?.trial
                            ? "Current · Trial"
                            : "Current Plan"}
                      </span>
                    )}
                    <div className="text-lg font-semibold text-gray-900 mt-1">
                      {plan.label}
                    </div>
                    <div className="text-xs text-gray-500 text-center mt-1 px-2 line-clamp-2">
                      {plan.description}
                    </div>

                    <div className="mt-4 text-center">
                      {plan.isFree ? (
                        <>
                          <div className="text-4xl font-extrabold text-gray-900 leading-none">
                            Free
                          </div>
                          <div className="text-sm text-gray-500 mt-1">Forever</div>
                        </>
                      ) : (
                        <div className="leading-none">
                          <span className="text-4xl font-extrabold text-gray-900">
                            ${price}
                          </span>
                          <span className="text-gray-500 text-sm">
                            /{period === "monthly" ? "mo" : "yr"}
                          </span>
                        </div>
                      )}
                    </div>

                    <div className="mt-4 w-full space-y-1.5">
                      <div className="flex items-center text-xs text-gray-600">
                        <span className="w-1.5 h-1.5 rounded-full bg-blue-600 mr-2" />
                        {plan.users} users
                      </div>
                      <div className="flex items-center text-xs text-gray-600">
                        <span className="w-1.5 h-1.5 rounded-full bg-blue-600 mr-2" />
                        {plan.modules.length} modules
                      </div>
                      {plan.trialDays > 0 && (
                        <div className="flex items-center text-xs text-gray-600">
                          <span className="w-1.5 h-1.5 rounded-full bg-blue-600 mr-2" />
                          {plan.trialDays}d trial
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Bottom row: Feature comparison */}
            <div className="grid gap-4" style={gridCols}>
              {/* Features list column */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-300 overflow-hidden flex flex-col">
                <div className="bg-gray-100 border-b border-gray-300 py-3 text-center text-sm font-medium text-gray-700">
                  Features
                </div>
                {features.map((f) => (
                  <div
                    key={f.value}
                    className="h-[38px] flex items-center justify-center text-sm text-gray-600 border-b border-gray-200 last:border-b-0"
                  >
                    {f.label}
                  </div>
                ))}
              </div>

              {plans.map((plan) => {
                const count = enabledCount(plan);
                const isBusy = actionPlan === plan.name;
                const current = isCurrentPlan(plan);
                return (
                  <div
                    key={plan.name}
                    className={`bg-white rounded-xl shadow-sm border overflow-hidden flex flex-col ${
                      current ? "border-blue-500 ring-1 ring-blue-500/30" : "border-gray-300"
                    }`}
                  >
                    <div className="bg-gray-100 border-b border-gray-300 py-3 text-center text-sm font-medium text-gray-700">
                      {count}/{features.length} Enabled
                    </div>
                    <div className="flex-1">
                      {features.map((f) => {
                        const ok = plan.modules.includes(f.value);
                        return (
                          <div
                            key={f.value}
                            className="h-[38px] flex items-center justify-center border-b border-gray-200 last:border-b-0"
                          >
                            {ok ? (
                              <span className="w-5 h-5 rounded-full bg-blue-50 border border-blue-600 flex items-center justify-center">
                                <Check className="w-3 h-3 text-blue-600" strokeWidth={3} />
                              </span>
                            ) : (
                              <span className="w-5 h-5 rounded-full bg-red-50 border border-red-400 flex items-center justify-center">
                                <X className="w-3 h-3 text-red-500" strokeWidth={3} />
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                    <div className="p-3 space-y-2 border-t border-gray-300">
                      <button
                        type="button"
                        onClick={() => void handleSubscribe(plan)}
                        disabled={isBusy || (current && !currentPlan?.expired)}
                        className="w-full px-3 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center justify-center gap-2"
                      >
                        {isBusy && <Loader2 className="w-4 h-4 animate-spin" />}
                        {current && !currentPlan?.expired
                          ? "Current Plan"
                          : plan.isFree
                            ? "Subscribe to Plan"
                            : "Subscribe & Pay"}
                      </button>
                      {plan.trialDays > 0 && !(current && currentPlan?.trial && !currentPlan?.expired) && (
                        <button
                          type="button"
                          onClick={() => void handleStartTrial(plan)}
                          disabled={isBusy}
                          className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <Clock className="w-3.5 h-3.5" />
                          Start Trial ({plan.trialDays}d)
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Pagination */}
            {pagination && pagination.totalPage > 1 && (
              <div className="mt-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div className="text-sm text-gray-500">
                  Page {pagination.currentPage} of {pagination.totalPage} ·{" "}
                  {pagination.totalData} plans
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page <= 1 || loading}
                    className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg bg-white hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-1"
                  >
                    <ChevronRight className="w-4 h-4 rotate-180" />
                    Previous
                  </button>
                  {Array.from({ length: pagination.totalPage }, (_, i) => i + 1).map(
                    (pageNumber) => (
                      <button
                        key={pageNumber}
                        type="button"
                        onClick={() => setPage(pageNumber)}
                        className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                          page === pageNumber
                            ? "bg-blue-600 text-white"
                            : "border border-gray-300 text-gray-700 hover:bg-gray-50"
                        }`}
                      >
                        {pageNumber}
                      </button>
                    ),
                  )}
                  <button
                    type="button"
                    onClick={() =>
                      setPage((p) => Math.min(pagination.totalPage, p + 1))
                    }
                    disabled={page >= pagination.totalPage || loading}
                    className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg bg-white hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-1"
                  >
                    Next
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
        </div>
      </div>
    </div>
  );
};
