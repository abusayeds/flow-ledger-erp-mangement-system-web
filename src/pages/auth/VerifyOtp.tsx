/**
 * File: src/pages/auth/VerifyOtp.tsx
 * OTP verification page for registration — also doubles as the "verify your
 * email" step (the backend sends a 6-digit OTP by email, not a link).
 *
 * Reached from Signup with `{ token, email }` in router state: `token` is the
 * short-lived registration token returned by POST /user/register, required as
 * a Bearer header on /user/verify-otp. Resending calls /user/register again
 * with just the email — the backend re-issues a fresh OTP + token for an
 * unverified account (see createUserDB).
 */

import React, { useState } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import { AuthLayout } from "../../components/auth/AuthLayout";
import { OTPInput } from "../../components/auth/OTPInput";
import { ArrowLeft } from "lucide-react";
import { api } from "../../lib/api/client";
import { alertApiError, alertToast } from "../../utils/alert";

type LocationState = { token?: string; email?: string } | null;

export const VerifyOTP: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const state = location.state as LocationState;
  const [token, setToken] = useState<string | undefined>(state?.token);
  const email = state?.email;
  const [isVerifying, setIsVerifying] = useState(false);
  const [resending, setResending] = useState(false);

  if (!token || !email) {
    return <Navigate to="/auth/signup" replace />;
  }

  const handleOTPComplete = async (otp: string) => {
    setIsVerifying(true);
    try {
      await api.post(
        "/user/verify-otp",
        { otp },
        { headers: { Authorization: `Bearer ${token}` } },
      );
      alertToast("Email verified. You can now log in.", "success");
      navigate("/auth/login", { replace: true });
    } catch (err) {
      alertApiError(err, "Invalid or expired OTP.");
    } finally {
      setIsVerifying(false);
    }
  };

  const handleResend = async () => {
    setResending(true);
    try {
      const result = await api.post<{ token: string }>("/user/register", {
        email,
      });
      setToken(result.token);
      alertToast("A new OTP has been sent to your email.", "success");
    } catch (err) {
      alertApiError(err, "Couldn't resend the OTP.");
    } finally {
      setResending(false);
    }
  };

  return (
    <AuthLayout
      title="Enter your OTP"
      subtitle={`We've sent a code to ${email}`}
    >
      <div className="space-y-6">
        <OTPInput onComplete={handleOTPComplete} />

        {isVerifying && (
          <p className="text-center text-sm text-gray-600">Verifying code...</p>
        )}

        <button
          type="button"
          onClick={handleResend}
          disabled={resending}
          className="w-full text-sm text-gray-600 hover:text-gray-900 py-2 disabled:opacity-60"
        >
          Didn't receive code?{" "}
          <span className="text-blue-600 font-medium">
            {resending ? "Resending..." : "Resend"}
          </span>
        </button>

        <div className="text-center">
          <Link
            to="/auth/login"
            className="inline-flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Login
          </Link>
        </div>
      </div>
    </AuthLayout>
  );
};
