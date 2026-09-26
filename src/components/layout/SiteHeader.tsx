/**
 * File: src/components/layout/SiteHeader.tsx
 * Public site navbar (logo + nav links + Sign In). Shown on the Landing page
 * and kept on the auth pages (Login/Signup/...) via AuthLayout, so visitors
 * never lose the top nav while moving between marketing and auth.
 */
import React, { useState } from "react";
import { Link } from "react-router-dom";
import { Menu, X } from "lucide-react";
import logo from "@/assets/logo.png";

const NAV = [
  { label: "Home", href: "/#top" },
  { label: "About Us", href: "/#about" },
  { label: "FAQ", href: "/#faq" },
  { label: "Help Center", href: "/#help" },
];

export const SiteHeader: React.FC = () => {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <header className="fixed inset-x-0 top-0 z-50 bg-[#0b1220]/95 backdrop-blur-md border-b border-white/10">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        <Link to="/#top" className="flex items-center gap-2.5">
          <img src={logo} alt="Qayd" className="h-8 w-auto object-contain" />
          <span className="text-xl font-semibold tracking-tight text-white">
            Qayd
          </span>
        </Link>

        <nav className="hidden items-center gap-8 md:flex">
          {NAV.map((item) => (
            <a
              key={item.href}
              href={item.href}
              className="text-sm text-white/70 transition hover:text-white"
            >
              {item.label}
            </a>
          ))}
        </nav>

        <div className="hidden items-center gap-3 md:flex">
          <Link
            to="/auth/login"
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700"
          >
            Sign In
          </Link>
        </div>

        <button
          type="button"
          className="md:hidden rounded-md p-2 text-white/80"
          onClick={() => setMenuOpen((v) => !v)}
          aria-label="Menu"
        >
          {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {menuOpen && (
        <div className="border-t border-white/10 bg-[#0b1220] px-4 py-4 md:hidden">
          <div className="flex flex-col gap-3">
            {NAV.map((item) => (
              <a
                key={item.href}
                href={item.href}
                onClick={() => setMenuOpen(false)}
                className="text-sm text-white/80"
              >
                {item.label}
              </a>
            ))}
            <Link
              to="/auth/login"
              onClick={() => setMenuOpen(false)}
              className="mt-2 rounded-md bg-blue-600 px-4 py-2 text-center text-sm font-medium text-white"
            >
              Sign In
            </Link>
          </div>
        </div>
      )}
    </header>
  );
};

export default SiteHeader;
