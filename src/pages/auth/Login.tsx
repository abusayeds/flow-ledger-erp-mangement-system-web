/**
 * File: src/pages/auth/Login.tsx
 * Login page - Email/Password authentication.
 *
 * Backend contract (see Postman "Common > auth"): POST /user/login.
 * After login, the user is redirected based on role (see getPostLoginRedirect).
 */

import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { AuthLayout } from "../../components/auth/AuthLayout";
import { SocialLogin } from "../../components/auth/SocialLogin";
import useAuth from "../../hooks/useAuth";
import { alertApiError, alertToast } from "../../utils/alert";
import { getPostLoginRedirect } from "../../auth/roles";

/** Dev quick-fill only — matches the seed accounts created by the backend. */
const QUICK_LOGIN_PRESETS = [
  { label: "Super Admin", email: "superadmin@gmail.com" },
  { label: "Company", email: "company@gmail.com" },
];
const QUICK_LOGIN_PASSWORD = "1qazxsw2";

export const Login: React.FC = () => {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    email: "",
    password: "",
    rememberMe: false,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const user = await login(formData.email, formData.password, formData.rememberMe);
      alertToast(`Welcome back, ${user.name || "user"}!`, "success");
      navigate(getPostLoginRedirect(user.role), { replace: true });
    } catch (err) {
      alertApiError(err, "Login failed. Check your credentials.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  const quickFill = (email: string) => {
    setFormData((prev) => ({ ...prev, email, password: QUICK_LOGIN_PASSWORD }));
  };

  return (
    <AuthLayout title="Welcome!" subtitle="Login to your account">
      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label
              htmlFor="email"
              className="block text-sm font-medium text-gray-700"
            >
              Enter your email
            </label>
            <div className="flex items-center gap-1.5">
              {QUICK_LOGIN_PRESETS.map((preset) => (
                <button
                  key={preset.email}
                  type="button"
                  onClick={() => quickFill(preset.email)}
                  className="px-2 py-0.5 rounded border border-gray-300 text-[11px] text-gray-600 hover:bg-gray-50 hover:border-gray-400"
                  title={preset.email}
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>
          <input
            id="email"
            name="email"
            type="email"
            required
            value={formData.email}
            onChange={handleChange}
            placeholder="name@example.com"
            className="w-full px-4 py-2.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent transition-all text-sm"
          />
        </div>

        <div>
          <label
            htmlFor="password"
            className="block text-sm font-medium text-gray-700 mb-1.5"
          >
            Enter your Password
          </label>
          <input
            id="password"
            name="password"
            type="password"
            required
            value={formData.password}
            onChange={handleChange}
            placeholder="••••••••"
            className="w-full px-4 py-2.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent transition-all text-sm"
          />
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <input
              id="rememberMe"
              name="rememberMe"
              type="checkbox"
              checked={formData.rememberMe}
              onChange={handleChange}
              className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-600"
            />
            <label htmlFor="rememberMe" className="ml-2 text-sm text-gray-700">
              Remember me
            </label>
          </div>
          <Link
            to="/auth/forgot-password"
            className="text-sm text-blue-600 hover:text-blue-700 font-medium"
          >
            Forgot password?
          </Link>
        </div>

        <button
          type="submit"
          disabled={submitting}
          className="w-full bg-blue-600 text-white py-2.5 px-4 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-2 transition-all font-medium text-sm disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {submitting ? "Logging in..." : "Login"}
        </button>

        <SocialLogin />

        <div className="text-center text-sm">
          <span className="text-gray-600">Don't have an account? </span>
          <Link
            to="/auth/signup"
            className="text-blue-600 hover:text-blue-700 font-medium"
          >
            Register
          </Link>
        </div>
      </form>
    </AuthLayout>
  );
};
