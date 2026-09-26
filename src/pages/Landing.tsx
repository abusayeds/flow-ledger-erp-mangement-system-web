/**
 * File: src/pages/Landing.tsx
 * Public marketing home for Qayd — guests land here at `/`.
 * Authenticated users are redirected to `/dashboard`.
 */

import React, { useEffect, useRef, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import {
  Calculator,
  Handshake,
  LayoutDashboard,
  ShoppingCart,
  Users,
  FolderKanban,
  ArrowRight,
} from "lucide-react";
import logo from "@/assets/logo.png";
import heroBackground from "@/assets/my-account-promo.png";
import useAuth from "@/hooks/useAuth";
import Loading from "@/components/utils/Loading";
import { SiteHeader } from "@/components/layout/SiteHeader";

const FEATURES = [
  {
    title: "ERP System",
    body: "Streamline resources and operations with comprehensive enterprise resource planning.",
    icon: LayoutDashboard,
  },
  {
    title: "Accounting System",
    body: "Manage finances with ease and accuracy through automated accounting tools.",
    icon: Calculator,
  },
  {
    title: "CRM System",
    body: "Strengthen customer relationships and improve sales with powerful CRM tools.",
    icon: Handshake,
  },
  {
    title: "POS System",
    body: "Fast and reliable point-of-sale solution for retail and service businesses.",
    icon: ShoppingCart,
  },
  {
    title: "HRM System",
    body: "Simplify employee management and payroll with integrated HR tools.",
    icon: Users,
  },
  {
    title: "Project System",
    body: "Organize and track projects efficiently with comprehensive project management.",
    icon: FolderKanban,
  },
];

const MODULES = [
  "Human Resources",
  "Accounting & Finance",
  "Project Management",
  "CRM & Sales",
  "Point of Sale",
];

const REASONS = [
  {
    title: "Centralized Business Hub",
    body: "Eliminate data silos. HRM, Accounting, CRM, Projects, and POS share one source of truth.",
  },
  {
    title: "Efficient Workforce Management",
    body: "Recruitment, attendance, payroll, and self-service portals in one HR suite.",
  },
  {
    title: "Financial Clarity & Precision",
    body: "Invoices, bills, and reports stay accurate across currencies and companies.",
  },
  {
    title: "Actionable Insights",
    body: "Dashboards turn daily activity into decisions you can act on immediately.",
  },
];

const FAQS = [
  {
    q: "Is Qayd self-hosted?",
    a: "Yes. Qayd is built for your infrastructure so you keep control of data and deployment.",
  },
  {
    q: "Can I start with a few modules?",
    a: "Absolutely. Enable Accounting, HRM, CRM, POS, or Projects as your team grows.",
  },
  {
    q: "Who can sign in?",
    a: "Company, staff, HR, vendors, and customers each get role-based access you control.",
  },
];

export const Landing: React.FC = () => {
  const { isAuthenticated, loading } = useAuth();
  const heroRef = useRef<HTMLElement>(null);
  const [heroVisible, setHeroVisible] = useState(false);

  useEffect(() => {
    const t = requestAnimationFrame(() => setHeroVisible(true));
    return () => cancelAnimationFrame(t);
  }, []);

  if (loading) return <Loading />;
  if (isAuthenticated) return <Navigate to="/dashboard" replace />;

  return (
    <div
      id="top"
      className="google-sans-flex-invoice min-h-screen text-gray-900 bg-[#0b1220]"
    >
      {/* Ambient brand wash */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 opacity-80"
        style={{
          background:
            "radial-gradient(ellipse 80% 50% at 20% -10%, rgba(0,122,255,0.35), transparent 55%), radial-gradient(ellipse 60% 40% at 90% 10%, rgba(26,133,255,0.18), transparent 50%), linear-gradient(180deg, #0b1220 0%, #121a28 40%, #0b1220 100%)",
        }}
      />

      <SiteHeader />

      {/* Hero — one composition */}
      <section
        ref={heroRef}
        className="relative overflow-hidden px-4 pb-16 pt-28 sm:px-6 sm:pb-20 sm:pt-32"
      >
        <div
          aria-hidden
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(180deg, #0b1220 0%, #101a2c 55%, #0b1220 100%)",
          }}
        />
        <div
          className={`relative z-10 mx-auto w-full max-w-6xl transition-all duration-700 ease-out ${
            heroVisible
              ? "translate-y-0 opacity-100"
              : "translate-y-6 opacity-0"
          }`}
        >
          <p className="mb-3 text-sm font-medium tracking-[0.2em] text-blue-400 uppercase">
            Qayd
          </p>
          <h1 className="max-w-3xl text-4xl font-semibold leading-[1.1] tracking-tight text-white sm:text-5xl lg:text-6xl">
            The complete ERP solution for your business
          </h1>
          <p className="mt-4 max-w-xl text-base text-white/70 sm:text-lg">
            Streamline finance, HR, CRM, and operations on a powerful platform
            designed around how you work.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Link
              to="/auth/login"
              className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-blue-700"
            >
              Login
              <ArrowRight className="h-4 w-4" />
            </Link>
            <a
              href="#contact"
              className="inline-flex items-center gap-2 rounded-md border border-white/20 bg-white/5 px-5 py-2.5 text-sm font-medium text-white backdrop-blur transition hover:bg-white/10"
            >
              Contact Us
            </a>
          </div>
        </div>
      </section>

      {/* Trust strip */}
      <section className="relative border-y border-white/10 bg-white/[0.03]">
        <div className="mx-auto grid max-w-6xl grid-cols-2 gap-6 px-4 py-10 sm:grid-cols-4 sm:px-6">
          {[
            ["10,000+", "Businesses Trust Us"],
            ["99.9%", "Uptime Guarantee"],
            ["24/7", "Customer Support"],
            ["50+", "Countries Worldwide"],
          ].map(([stat, label]) => (
            <div key={label} className="text-center sm:text-left">
              <div className="text-2xl font-semibold text-blue-400">{stat}</div>
              <div className="mt-1 text-sm text-white/55">{label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section id="about" className="relative px-4 py-20 sm:px-6">
        <div className="mx-auto max-w-6xl">
          <h2 className="text-3xl font-semibold tracking-tight text-white sm:text-4xl">
            Powerful features
          </h2>
          <p className="mt-3 max-w-2xl text-white/60">
            Everything your business needs in one integrated platform.
          </p>
          <div className="mt-12 grid gap-10 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f) => (
              <div key={f.title} className="group">
                <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-md bg-blue-600/20 text-blue-400 transition group-hover:bg-blue-600 group-hover:text-white">
                  <f.icon className="h-5 w-5" />
                </div>
                <h3 className="text-lg font-medium text-white">{f.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-white/55">
                  {f.body}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Modules */}
      <section className="relative border-t border-white/10 px-4 py-20 sm:px-6">
        <div className="mx-auto max-w-6xl">
          <h2 className="text-3xl font-semibold tracking-tight text-white sm:text-4xl">
            Complete business modules
          </h2>
          <p className="mt-3 max-w-2xl text-white/60">
            Deploy the modules you need to streamline every part of daily
            operations.
          </p>
          <div className="mt-10 flex flex-wrap gap-3">
            {MODULES.map((m) => (
              <span
                key={m}
                className="rounded-md border border-white/15 px-4 py-2 text-sm text-white/80"
              >
                {m}
              </span>
            ))}
          </div>
          <div className="mt-14 grid gap-10 lg:grid-cols-2 lg:items-center">
            <div>
              <h3 className="text-2xl font-semibold text-white">HRM System</h3>
              <p className="mt-4 text-sm leading-relaxed text-white/60">
                Transform human resource operations across the employee
                lifecycle — recruitment, onboarding, attendance, payroll, and
                self-service portals that keep teams productive.
              </p>
            </div>
            <div
              className="min-h-[240px] rounded-lg bg-cover bg-center"
              style={{
                backgroundImage:
                  "url('https://images.unsplash.com/photo-1522071820081-009f0129c71c?auto=format&fit=crop&w=1200&q=80')",
              }}
            />
          </div>
        </div>
      </section>

      {/* Why Qayd */}
      <section className="relative border-t border-white/10 px-4 py-20 sm:px-6">
        <div className="mx-auto max-w-6xl">
          <h2 className="text-3xl font-semibold tracking-tight text-white sm:text-4xl">
            Why choose Qayd?
          </h2>
          <div className="mt-12 grid gap-8 sm:grid-cols-2">
            {REASONS.map((r) => (
              <div key={r.title}>
                <h3 className="text-lg font-medium text-blue-400">{r.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-white/60">
                  {r.body}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Gallery / in action */}
      <section className="relative border-t border-white/10 px-4 py-20 sm:px-6">
        <div className="mx-auto max-w-6xl">
          <h2 className="text-3xl font-semibold tracking-tight text-white sm:text-4xl">
            See Qayd in action
          </h2>
          <p className="mt-3 max-w-2xl text-white/60">
            An interface designed to keep workflows clear from day one.
          </p>
          <div
            className="mt-10 min-h-[320px] w-full rounded-lg bg-cover bg-center shadow-[0_0_0_1px_rgba(255,255,255,0.08)]"
            style={{
              backgroundImage: `url('${heroBackground}')`,
            }}
            role="img"
            aria-label="Qayd product preview"
          />
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="relative border-t border-white/10 px-4 py-20 sm:px-6">
        <div className="mx-auto max-w-3xl">
          <h2 className="text-3xl font-semibold tracking-tight text-white">
            FAQ
          </h2>
          <div className="mt-10 space-y-6">
            {FAQS.map((item) => (
              <div key={item.q} className="border-b border-white/10 pb-6">
                <h3 className="text-base font-medium text-white">{item.q}</h3>
                <p className="mt-2 text-sm text-white/55">{item.a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section
        id="help"
        className="relative border-t border-white/10 px-4 py-20 sm:px-6"
      >
        <div className="mx-auto max-w-6xl text-center">
          <h2 className="text-3xl font-semibold tracking-tight text-white sm:text-4xl">
            Ready to transform your business?
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-white/60">
            Join teams already using Qayd to run finance, people, and projects
            in one place.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Link
              to="/auth/login"
              className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-blue-700"
            >
              Login
            </Link>
            <a
              href="#contact"
              className="inline-flex items-center gap-2 rounded-md border border-white/20 px-5 py-2.5 text-sm font-medium text-white hover:bg-white/5"
            >
              Contact Us
            </a>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer
        id="contact"
        className="relative border-t border-white/10 px-4 pb-10 pt-16 sm:px-6"
      >
        <div className="mx-auto grid max-w-6xl gap-10 sm:grid-cols-2 lg:grid-cols-4">
          <div className="lg:col-span-2">
            <div className="flex items-center gap-2.5">
              <img src={logo} alt="" className="h-7 w-auto" />
              <span className="text-lg font-semibold text-white">Qayd</span>
            </div>
            <p className="mt-3 max-w-sm text-sm text-white/55">
              The complete business management solution for modern enterprises.
            </p>
            <p className="mt-4 text-sm text-white/55">support@qayd.com</p>
            <p className="text-sm text-white/55">+1 (555) 123-4567</p>
          </div>
          <div>
            <div className="text-sm font-medium text-white">Product</div>
            <ul className="mt-3 space-y-2 text-sm text-white/55">
              <li>
                <a href="#about" className="hover:text-white">
                  Features
                </a>
              </li>
              <li>
                <Link to="/auth/login" className="hover:text-white">
                  Demo
                </Link>
              </li>
            </ul>
          </div>
          <div>
            <div className="text-sm font-medium text-white">Company</div>
            <ul className="mt-3 space-y-2 text-sm text-white/55">
              <li>
                <a href="#about" className="hover:text-white">
                  About
                </a>
              </li>
              <li>
                <a href="#contact" className="hover:text-white">
                  Contact
                </a>
              </li>
              <li>
                <a href="#help" className="hover:text-white">
                  Support
                </a>
              </li>
            </ul>
          </div>
        </div>
        <div className="mx-auto mt-12 max-w-6xl border-t border-white/10 pt-6 text-center text-xs text-white/40">
          © {new Date().getFullYear()} Qayd. All rights reserved.
        </div>
      </footer>
    </div>
  );
};

export default Landing;
