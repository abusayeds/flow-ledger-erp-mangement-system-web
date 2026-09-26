/**
 * File: src/pages/auth/VerifyEmail.tsx
 * Email Verification page - Confirmation screen after signup
 */

import React from "react";
import { Link } from "react-router-dom";
import { AuthLayout } from "../../components/auth/AuthLayout";
import { Mail } from "lucide-react";

export const VerifyEmail: React.FC = () => {
  const handleResendEmail = () => {
    console.log("Resending verification email...");
  };

  return (
    <AuthLayout
      title="Verify Your Email"
      subtitle="We've sent a verification link to your email"
    >
      <div className="text-center space-y-6">
        {/* Email Icon */}
        <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto">
          <Mail className="w-8 h-8 text-blue-600" />
        </div>

        {/* Instructions */}
        <div className="space-y-3">
          <p className="text-sm text-gray-600">
            Please check your email and click on the verification link to
            activate your account.
          </p>
          <p className="text-xs text-gray-500">
            Didn't receive the email? Check your spam folder.
          </p>
        </div>

        {/* Resend Button */}
        <button
          onClick={handleResendEmail}
          className="w-full bg-blue-600 text-white py-2.5 px-4 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-2 transition-all font-medium text-sm"
        >
          Resend Verification Email
        </button>

        {/* Back to Login */}
        <div className="text-sm">
          <Link
            to="/auth/login"
            className="text-blue-600 hover:text-blue-700 font-medium"
          >
            Back to Login
          </Link>
        </div>
      </div>
    </AuthLayout>
  );
};
