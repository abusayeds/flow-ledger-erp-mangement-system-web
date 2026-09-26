/**
 * File: src/pages/Rewards.tsx
 * Rewards — matches references/rewards/*.png (Moon Invoice referral modal)
 * in the Qayd blue theme: hero banner, Invite Your Friends email form,
 * Share the Referral Link with Copy + social share buttons (Facebook opens
 * facebook.com/sharer/sharer.php, WhatsApp opens wa.me, per the reference
 * filename), Earn Your Rewards explainer and the 3-step strip.
 * Sent invites persist in meta row `rewards:invites`.
 */

import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/db/db";
import { api } from "@/lib/api/client";
import { getToken } from "@/lib/api/tokenStore";
import { toArray } from "@/services/_http";
import { showToast } from "../utils/toast";
import { X, Copy, UserPlus, PartyPopper, Gift, Megaphone } from "lucide-react";

const REFERRAL_LINK =
  "https://www.qayd.app/signup?utm_source=referral&utm_campaign=invite&ref=info@inovoic.com";
const KEY = "rewards:invites";

/* ── social share buttons (brand icons inline, links per reference hint) ── */

const enc = encodeURIComponent(REFERRAL_LINK);
const SHARE_TARGETS: { name: string; bg: string; href: string; path: string }[] = [
  {
    name: "Facebook",
    bg: "#1877F2",
    href: `https://www.facebook.com/sharer/sharer.php?u=${enc}`,
    path: "M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z",
  },
  {
    name: "X",
    bg: "#000000",
    href: `https://twitter.com/intent/tweet?url=${enc}&text=${encodeURIComponent("Join me on Qayd — easy invoicing!")}`,
    path: "M18.901 1.153h3.68l-8.04 9.19L24 22.846h-7.406l-5.8-7.584-6.638 7.584H.474l8.6-9.83L0 1.154h7.594l5.243 6.932ZM17.61 20.644h2.039L6.486 3.24H4.298Z",
  },
  {
    name: "LinkedIn",
    bg: "#0A66C2",
    href: `https://www.linkedin.com/sharing/share-offsite/?url=${enc}`,
    path: "M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z",
  },
  {
    name: "WhatsApp",
    bg: "#25D366",
    href: `https://wa.me/?text=${encodeURIComponent("Join me on Qayd — easy invoicing! " + REFERRAL_LINK)}`,
    path: "M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z",
  },
  {
    name: "Messenger",
    bg: "#0084FF",
    href: `https://www.facebook.com/sharer/sharer.php?u=${enc}`,
    path: "M12 0C5.24 0 0 4.952 0 11.64c0 3.499 1.434 6.522 3.769 8.61a.96.96 0 01.323.683l.065 2.135a.96.96 0 001.347.847l2.381-1.05a.96.96 0 01.642-.048c1.094.3 2.257.464 3.473.464 6.76 0 12-4.952 12-11.64C24 4.952 18.76 0 12 0zm7.207 8.954l-3.525 5.592a1.8 1.8 0 01-2.604.48l-2.804-2.102a.72.72 0 00-.867.003l-3.786 2.873c-.505.384-1.165-.22-.827-.757l3.525-5.592a1.8 1.8 0 012.604-.48l2.804 2.102a.72.72 0 00.867-.003l3.786-2.873c.505-.384 1.165.22.827.757z",
  },
];

const STEPS = [
  {
    icon: UserPlus,
    title: "Invite Your Friends",
    text: "Enter the email address(es) you wish to invite to avail of this offer.",
  },
  {
    icon: PartyPopper,
    title: "Excitement on the Way!",
    text: "Wait for your friends to join Qayd! Stay excited to win rewards!",
  },
  {
    icon: Gift,
    title: "Earn Rewards",
    text: "Get a $50 USD Amazon Voucher as a reward with each account paid subscription!",
  },
];

export const Rewards: React.FC = () => {
  const navigate = useNavigate();
  const invites = useLiveQuery(async () => {
    const row = await db.meta.get(KEY);
    return (row?.value as string[]) || null;
  }, []);
  useEffect(() => {
    if (invites === null) db.meta.put({ key: KEY, value: [] });
  }, [invites]);

  // Hydrate the invite list from the backend when authenticated (data layer only).
  useEffect(() => {
    if (!getToken()) return;
    (async () => {
      try {
        const res = await api.raw.get("/referral/all");
        const emails = toArray<any>(res.data).map((r) => String(r.email)).filter(Boolean);
        await db.meta.put({ key: KEY, value: emails });
      } catch {
        /* keep the local cache */
      }
    })();
  }, []);

  const [email, setEmail] = useState("");

  const send = async () => {
    if (!/\S+@\S+\.\S+/.test(email)) {
      showToast("Enter a valid email address", "error");
      return;
    }
    const addr = email.trim();
    if (getToken()) {
      try {
        await api.raw.post("/referral/invite", { email: addr });
        const res = await api.raw.get("/referral/all");
        const emails = toArray<any>(res.data).map((r) => String(r.email)).filter(Boolean);
        await db.meta.put({ key: KEY, value: emails });
        showToast(`Invitation sent to ${addr}`, "success");
        setEmail("");
        return;
      } catch {
        /* fall through to local so the invite isn't lost */
      }
    }
    await db.meta.put({ key: KEY, value: [...(invites || []), addr] });
    showToast(`Invitation sent to ${addr}`, "success");
    setEmail("");
  };

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(REFERRAL_LINK);
      showToast("Referral link copied to clipboard", "success");
    } catch {
      showToast("Could not copy the link", "error");
    }
  };

  return (
    <div className="module-page-shell overflow-y-auto">
      <div className="max-w-5xl mx-auto p-4 sm:p-6">
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm">
          {/* header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
            <h2 className="text-lg font-semibold text-gray-900">Rewards</h2>
            <button onClick={() => navigate(-1)} title="Close rewards" className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg">
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="p-6 space-y-6">
            {/* hero banner */}
            <div className="rounded-xl border border-blue-200 bg-blue-50/70 px-6 py-6 flex items-center justify-center gap-6 text-center relative overflow-hidden">
              <Megaphone className="w-10 h-10 text-blue-400 shrink-0 -scale-x-100 hidden sm:block" />
              <div>
                <h3 className="text-2xl font-bold text-gray-900">Invite your friends and get exciting prizes</h3>
                <p className="text-sm text-gray-600 mt-1.5">
                  Earn a <span className="font-semibold">$50 USD Amazon voucher</span> EACH TIME while you refer anyone.
                </p>
              </div>
              <Megaphone className="w-10 h-10 text-blue-400 shrink-0 hidden sm:block" />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
              {/* invite + share */}
              <div className="lg:col-span-3 rounded-xl border border-gray-200 p-6">
                <h4 className="text-base font-semibold text-gray-900 mb-3">Invite Your Friends</h4>
                <div className="flex gap-3">
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && send()}
                    placeholder="Email Address"
                    className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                  />
                  <button onClick={send} className="px-5 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700">
                    Send
                  </button>
                </div>
                {(invites || []).length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-3">
                    {(invites || []).map((e, i) => (
                      <span key={i} className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs bg-green-100 text-green-700">
                        {e} · Sent
                      </span>
                    ))}
                  </div>
                )}

                <h4 className="text-base font-semibold text-gray-900 mt-7 mb-3">Share the Referral Link</h4>
                <div className="flex gap-3">
                  <div className="flex-1 relative">
                    <span className="absolute -top-2 left-3 px-1 bg-white text-[10px] text-gray-400">Referral Link</span>
                    <input
                      readOnly
                      value={REFERRAL_LINK}
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md text-gray-600 bg-white truncate"
                    />
                  </div>
                  <button onClick={copyLink} className="flex items-center gap-1.5 px-4 py-2 border border-gray-300 text-sm text-gray-700 rounded-md hover:bg-gray-50">
                    <Copy className="w-4 h-4" /> Copy Link
                  </button>
                </div>

                <div className="flex items-center justify-center gap-3 mt-8 pt-5 border-t border-gray-100">
                  <span className="text-sm text-gray-500">or Share Via</span>
                  {SHARE_TARGETS.map((s) => (
                    <a
                      key={s.name}
                      href={s.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      title={`Share via ${s.name}`}
                      className="w-9 h-9 rounded-lg flex items-center justify-center hover:opacity-85"
                      style={{ backgroundColor: s.bg }}
                    >
                      <svg viewBox="0 0 24 24" className="w-5 h-5" fill="#fff">
                        <path d={s.path} />
                      </svg>
                    </a>
                  ))}
                </div>
              </div>

              {/* earn your rewards */}
              <div className="lg:col-span-2 rounded-xl border border-gray-200 overflow-hidden">
                <div className="px-5 py-3.5 border-b border-gray-100 bg-gray-50">
                  <h4 className="text-base font-semibold text-gray-900">Earn Your Rewards 🎉 🎉 🎉</h4>
                </div>
                <div className="px-5 py-4 space-y-3 text-sm text-gray-600">
                  <p className="font-semibold text-gray-900">
                    Earn a $50 USD Amazon voucher EACH TIME while you refer anyone.
                  </p>
                  <p>
                    It's a hard time to start up or grow any business in the competitive market. If you want to help a
                    business owner, freelancer, contractor or any user to get the business support what they required?
                  </p>
                  <p>
                    Refer to Qayd and we will give them a free trial to grow their business to manage sales, purchases
                    and many more amazing features with interactive reports. Even they will get payment 10X faster.
                  </p>
                  <p>
                    After your referral becomes a Qayd client and subscribes to our any YEARLY plan then we will send
                    you a $50 USD Amazon gift voucher.
                  </p>
                  <p>
                    The best part is that you can refer UNLIMITED business owners, freelancers and contractors.
                  </p>
                </div>
              </div>
            </div>

            {/* steps strip */}
            <div className="rounded-xl border border-gray-200 px-6 py-6">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-8 relative">
                <div className="hidden sm:block absolute top-6 left-[20%] right-[20%] border-t-2 border-dashed border-gray-200" />
                {STEPS.map((s) => (
                  <div key={s.title} className="text-center relative">
                    <div className="w-12 h-12 mx-auto rounded-full bg-blue-50 border border-blue-100 flex items-center justify-center relative z-10">
                      <s.icon className="w-5 h-5 text-blue-600" />
                    </div>
                    <p className="text-sm font-semibold text-gray-900 mt-3">{s.title}</p>
                    <p className="text-xs text-gray-500 mt-1.5 max-w-60 mx-auto">{s.text}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
