/**
 * File: src/pages/plan/CheckoutSuccess.tsx
 * Landing page Stripe/our backend redirects to after a successful checkout.
 * Reached via the `successUrl` passed to POST /subscription/checkout.
 */

import React from "react";
import { Link } from "react-router-dom";
import { CheckCircle, LayoutDashboard, CreditCard } from "lucide-react";

export const CheckoutSuccess: React.FC = () => {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 max-w-md w-full p-8 text-center">
        <div className="w-16 h-16 mx-auto mb-5 rounded-full bg-teal-50 flex items-center justify-center">
          <CheckCircle className="w-9 h-9 text-teal-500" strokeWidth={2.2} />
        </div>

        <h1 className="text-2xl font-semibold text-gray-900">
          Payment Successful
        </h1>
        <p className="text-sm text-gray-500 mt-2">
          Thank you! Your subscription is now active. A receipt has been sent to
          your email.
        </p>

        <div className="mt-7 flex flex-col sm:flex-row gap-3">
          <Link
            to="/"
            className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-teal-500 text-white rounded-lg text-sm font-medium hover:bg-teal-600 transition-colors"
          >
            <LayoutDashboard className="w-4 h-4" />
            Go to Dashboard
          </Link>
          <Link
            to="/plan"
            className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-white border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
          >
            <CreditCard className="w-4 h-4" />
            View Plans
          </Link>
        </div>
      </div>
    </div>
  );
};

export default CheckoutSuccess;
