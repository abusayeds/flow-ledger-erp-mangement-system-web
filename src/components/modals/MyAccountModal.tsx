/**
 * My Account modal — opened from header company avatar → My Account.
 * Shows email, phone, current plan, and a dashboard promo banner.
 */
import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import {
  X,
  Pencil,
  BadgeCheck,
  FileText,
  ShoppingBag,
  Loader2,
  Plus,
  Settings as SettingsIcon,
} from "lucide-react";
import { api } from "@/lib/api/client";
import { toArray } from "@/services/_http";
import useAuth from "@/hooks/useAuth";
import { alertApiError, alertSuccess } from "@/utils/alert";
import Swal from "@/utils/alert";
import myAccountPromo from "@/assets/my-account-promo.png";

type Props = {
  open: boolean;
  onClose: () => void;
  /** Header summary — passed from Header.tsx (already fetches company/plan). */
  companyName?: string;
  companyLogoUrl?: string;
  companyInitial?: string;
  isOwner?: boolean;
  planBadge?: { name: string; trial: boolean; expired: boolean } | null;
  onLogoBroken?: () => void;
};

type PlanRow = {
  id: string;
  name: string;
  detail: string;
  status: "Active" | "Expired" | "Cancelling" | "None";
  channel: string;
  actionLabel: string;
  actionPath: string;
  canCancel: boolean;
  endDate: string | null;
};

export const MyAccountModal: React.FC<Props> = ({
  open,
  onClose,
  companyName,
  companyLogoUrl,
  companyInitial,
  isOwner,
  planBadge,
  onLogoBroken,
}) => {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [loading, setLoading] = useState(true);
  const [cancelling, setCancelling] = useState(false);
  const [email, setEmail] = useState(user?.email || "");
  const [phone, setPhone] = useState("");
  const [accountName, setAccountName] = useState(user?.name || "");
  const [plan, setPlan] = useState<PlanRow | null>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const loadAccount = async () => {
    let nextEmail = user?.email || "";
    let nextPhone = "";
    let nextName = user?.name || "";
    let nextPlan: PlanRow | null = null;

    try {
      const res = await api.raw.get("/company-register/all");
      const list = toArray<any>(res.data);
      const owner = list.find((c) => c.is_owner) || list[0];
      if (owner) {
        nextName = String(owner.business_name || nextName).trim() || nextName;
        nextEmail = String(owner.email || nextEmail).trim() || nextEmail;
        nextPhone = String(owner.phone || owner.mobile || "").trim();
      }
    } catch {
      /* keep auth defaults */
    }

    try {
      const sub = await api.get<any>("/subscription/my-subscription");
      if (sub && sub.exists !== false && (sub.plan_name || sub.plan_id)) {
        const expired = !!sub.expired;
        const cancelAtPeriodEnd =
          !!sub.cancel_at_period_end || sub.auto_renew === false || sub.status === "cancelled";
        const users =
          sub.number_of_users == null || Number(sub.number_of_users) < 0
            ? "Unlimited users"
            : `${sub.number_of_users} User${Number(sub.number_of_users) === 1 ? "" : "s"}`;
        const endDate = sub.end_date ? String(sub.end_date) : null;
        const endLabel = endDate
          ? new Date(endDate).toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
              year: "numeric",
            })
          : null;
        nextPlan = {
          id: String(sub._id || sub.plan_id || "current"),
          name: String(sub.plan_name || "Premium"),
          detail:
            cancelAtPeriodEnd && !expired && endLabel
              ? `Access until ${endLabel}`
              : `1 Business, ${users}`,
          status: expired ? "Expired" : cancelAtPeriodEnd ? "Cancelling" : "Active",
          channel: sub.is_trial ? "Trial" : String(sub.billing_cycle || "Web"),
          actionLabel: expired ? "Renew" : "Upgrade Now",
          actionPath: "/plan",
          canCancel: !expired && !cancelAtPeriodEnd,
          endDate,
        };
      }
    } catch {
      /* no plan */
    }

    setEmail(nextEmail);
    setPhone(nextPhone);
    setAccountName(nextName);
    setPlan(nextPlan);
  };

  useEffect(() => {
    if (!open) return;
    let alive = true;
    setLoading(true);
    void (async () => {
      await loadAccount();
      if (alive) setLoading(false);
    })();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, user?.email, user?.name]);

  if (!open) return null;

  const goPlan = () => {
    onClose();
    navigate("/plan");
  };

  const goAddCompany = () => {
    onClose();
    navigate("/companies", { state: { openCreate: true } });
  };

  const goSettings = () => {
    onClose();
    navigate("/settings");
  };

  const handleLogout = () => {
    onClose();
    logout();
    navigate("/auth/login");
  };

  const handleCancel = async () => {
    if (!plan?.canCancel) return;
    const endLabel = plan.endDate
      ? new Date(plan.endDate).toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          year: "numeric",
        })
      : "the end of the current period";
    const result = await Swal.fire({
      icon: "warning",
      title: "Cancel subscription?",
      html: `Auto-renew will stop. You'll keep access to <b>${plan.name}</b> until <b>${endLabel}</b>.`,
      showCancelButton: true,
      confirmButtonText: "Yes, cancel renew",
      cancelButtonText: "Keep plan",
      confirmButtonColor: "#dc2626",
    });
    if (!result.isConfirmed) return;
    setCancelling(true);
    try {
      await api.post("/subscription/cancel");
      await alertSuccess("Subscription cancelled. You keep access until the current period ends.");
      window.dispatchEvent(new Event("qayd:subscription-changed"));
      await loadAccount();
    } catch (err) {
      alertApiError(err, "Couldn't cancel subscription.");
    } finally {
      setCancelling(false);
    }
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[200] flex items-start justify-center bg-black/50 p-4 overflow-y-auto"
      onMouseDown={onClose}
    >
      <div
        onMouseDown={(e) => e.stopPropagation()}
        className="w-full max-w-[560px] my-8 rounded-xl overflow-hidden shadow-2xl border border-gray-200 bg-white text-gray-900"
      >
        <div className="relative flex items-center justify-center h-12 px-3 border-b border-gray-200 bg-gray-50">
          <h2 className="text-[15px] font-semibold tracking-wide text-gray-900">My Account</h2>
          <button
            type="button"
            onClick={onClose}
            className="absolute right-3 p-1.5 rounded-md hover:bg-gray-200 text-gray-600"
            title="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex items-center gap-3 px-5 py-3.5 border-b border-gray-200">
          <div className="w-11 h-11 rounded-full bg-blue-600 flex items-center justify-center text-white text-base font-semibold overflow-hidden flex-shrink-0">
            {companyLogoUrl ? (
              <img
                src={companyLogoUrl}
                alt={companyName || "Company"}
                className="w-full h-full object-cover"
                onError={onLogoBroken}
              />
            ) : (
              companyInitial || (companyName || "?").charAt(0).toUpperCase()
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[15px] text-gray-900 truncate">{companyName || user?.name}</p>
            <div className="flex items-center gap-1.5 mt-1 flex-wrap">
              {isOwner && (
                <span className="px-2 py-0.5 rounded bg-gray-100 text-[11px] text-gray-700">
                  Owner
                </span>
              )}
              {planBadge && (
                <span
                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium ${
                    planBadge.expired
                      ? "bg-red-100 text-red-700"
                      : planBadge.trial
                        ? "bg-amber-100 text-amber-800"
                        : "bg-blue-100 text-blue-700"
                  }`}
                  title={planBadge.expired ? "Plan expired" : planBadge.trial ? "Trial plan" : "Active plan"}
                >
                  {planBadge.name}
                  {planBadge.trial && !planBadge.expired ? " · Trial" : ""}
                  {planBadge.expired ? " · Expired" : ""}
                </span>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={goAddCompany}
            className="flex-shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium border border-gray-200 text-gray-700 hover:bg-gray-50"
          >
            <Plus className="w-3.5 h-3.5" strokeWidth={2.2} />
            Add Company
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center gap-2 py-20 text-sm text-gray-500">
            <Loader2 className="w-5 h-5 animate-spin" />
            Loading account…
          </div>
        ) : (
          <>
            <div className="px-5 pt-5 pb-2 space-y-4">
              <Field
                label="Account Email*"
                value={email || "—"}
                verified={!!email}
                onEdit={() => {
                  onClose();
                  navigate("/companies");
                }}
              />
              <Field
                label="Phone Number"
                value={phone || "Not set"}
                verified={!!phone}
                onEdit={() => {
                  onClose();
                  navigate("/companies");
                }}
              />
            </div>

            <div className="flex items-center justify-between gap-3 px-5 py-3 border-y border-gray-100">
              <button
                type="button"
                onClick={goSettings}
                className="inline-flex items-center gap-2 text-sm text-gray-800 hover:text-gray-900"
              >
                <SettingsIcon className="w-4 h-4 text-gray-500" />
                Settings
              </button>
              <button
                type="button"
                onClick={handleLogout}
                className="px-3.5 py-1.5 text-sm text-gray-800 rounded bg-gray-100 hover:bg-gray-200 border border-gray-200"
              >
                Log Out
              </button>
            </div>

            <div className="px-5 pt-3 pb-4">
              <h3 className="text-sm font-semibold mb-3 text-gray-900">My Plan</h3>
              {plan ? (
                <>
                  <PlanCard
                    icon={plan.status === "Expired" ? ShoppingBag : FileText}
                    name={plan.name}
                    detail={plan.detail}
                    status={plan.status}
                    channel={plan.channel}
                    actionLabel={plan.actionLabel}
                    onAction={goPlan}
                  />
                  {plan.canCancel && (
                    <button
                      type="button"
                      disabled={cancelling}
                      onClick={() => void handleCancel()}
                      className="mt-3 w-full px-3 py-2 text-sm font-medium rounded-md border border-red-200 text-red-700 bg-red-50 hover:bg-red-100 disabled:opacity-50"
                    >
                      {cancelling ? "Cancelling…" : "Cancel subscription (stop auto-renew)"}
                    </button>
                  )}
                  {plan.status === "Cancelling" && (
                    <p className="mt-2 text-xs text-amber-700">
                      Auto-renew is off. Your plan stays active until the period ends.
                    </p>
                  )}
                </>
              ) : (
                <PlanCard
                  icon={FileText}
                  name="No plan"
                  detail={accountName ? `${accountName}` : "Choose a subscription"}
                  status="None"
                  channel="Web"
                  actionLabel="View Plans"
                  onAction={goPlan}
                />
              )}
            </div>

            <div className="mx-5 mb-6 rounded-lg overflow-hidden border border-gray-200">
              <img
                src={myAccountPromo}
                alt="Dashboard preview"
                className="w-full h-auto max-h-[320px] object-cover object-top block"
              />
            </div>
            <p className="text-center text-sm font-medium text-gray-800 px-5 pb-6">
              One plan for All Platform Apps
            </p>
          </>
        )}
      </div>
    </div>,
    document.body,
  );
};

const Field: React.FC<{
  label: string;
  value: string;
  verified?: boolean;
  onEdit: () => void;
}> = ({ label, value, verified, onEdit }) => (
  <div>
    <label className="block text-xs text-gray-500 mb-1.5">{label}</label>
    <div className="flex items-center gap-2 h-11 px-3 rounded-md border border-gray-200 bg-gray-50">
      {verified ? (
        <span className="w-5 h-5 rounded-full bg-blue-500 flex items-center justify-center flex-shrink-0">
          <BadgeCheck className="w-3.5 h-3.5 text-white" />
        </span>
      ) : (
        <span className="w-5 h-5 rounded-full border border-gray-300 flex-shrink-0" />
      )}
      <span className="flex-1 min-w-0 text-sm text-gray-900 truncate">{value}</span>
      {verified ? <span className="text-xs text-blue-600 flex-shrink-0">Verified</span> : null}
      <button
        type="button"
        onClick={onEdit}
        className="p-1 rounded hover:bg-gray-200 text-gray-600 flex-shrink-0"
        title="Edit"
      >
        <Pencil className="w-4 h-4" />
      </button>
    </div>
  </div>
);

const PlanCard: React.FC<{
  icon: React.ElementType;
  name: string;
  detail: string;
  status: "Active" | "Expired" | "Cancelling" | "None";
  channel: string;
  actionLabel: string;
  onAction: () => void;
}> = ({ icon: Icon, name, detail, status, channel, actionLabel, onAction }) => (
  <div className="flex items-center gap-3 py-3 border-b border-gray-200 last:border-b-0">
    <div className="w-11 h-11 rounded-lg bg-blue-600 flex items-center justify-center flex-shrink-0">
      <Icon className="w-5 h-5 text-white" />
    </div>
    <div className="min-w-0 flex-1">
      <p className="text-sm font-semibold text-gray-900 truncate">{name}</p>
      <p className="text-xs text-gray-500 truncate">{detail}</p>
    </div>
    <div className="text-right flex-shrink-0 mr-2">
      <p
        className={`text-sm font-semibold ${
          status === "Active"
            ? "text-emerald-600"
            : status === "Expired"
              ? "text-red-600"
              : status === "Cancelling"
                ? "text-amber-600"
                : "text-gray-400"
        }`}
      >
        {status === "None" ? "—" : status}
      </p>
      <p className="text-[11px] text-gray-500 capitalize">{channel}</p>
    </div>
    <button
      type="button"
      onClick={onAction}
      className="px-3 py-1.5 text-xs font-medium rounded-md bg-gray-100 hover:bg-gray-200 text-gray-800 border border-gray-200 whitespace-nowrap"
    >
      {actionLabel}
    </button>
  </div>
);

export default MyAccountModal;
