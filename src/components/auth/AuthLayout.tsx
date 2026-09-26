/**
 * File: src/components/auth/AuthLayout.tsx
 * Shared layout wrapper for all authentication pages
 */

import React from "react";
import logo from "@/assets/logo.png";
import { SiteHeader } from "@/components/layout/SiteHeader";

interface AuthLayoutProps {
  children: React.ReactNode;
  title: string;
  subtitle?: string;
}

export const AuthLayout: React.FC<AuthLayoutProps> = ({
  children,
  title,
  subtitle,
}) => {
  return (
    <div className="min-h-screen bg-gray-50">
      <SiteHeader />
      <div className="flex items-center justify-center pt-24 pb-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-md w-full">
          {/* Card Container */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8">
            {/* Logo */}
            <div className="flex justify-center mb-6">
              <img src={logo} alt="Logo" className="h-16 w-auto object-contain" />
            </div>

            {/* Title */}
            <div className="text-center mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 mb-2">
                {title}
              </h2>
              {subtitle && <p className="text-sm text-gray-600">{subtitle}</p>}
            </div>

            {/* Content */}
            {children}
          </div>
        </div>
      </div>
    </div>
  );
};
