/**
 * File: src/components/auth/SocialLogin.tsx
 * Social login buttons (Google, Apple).
 *
 * Google uses Google Identity Services (@react-oauth/google) to get an ID
 * token, which is verified server-side in POST /user/google-login. A
 * first-time Google sign-in auto-creates a `company`-role account there.
 * Apple has no credential configured yet, so its button stays disabled.
 */

import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { GoogleLogin } from "@react-oauth/google";
import useAuth from "../../hooks/useAuth";
import { alertApiError, alertToast } from "../../utils/alert";
import { getPostLoginRedirect } from "../../auth/roles";

export const SocialLogin: React.FC = () => {
  const { loginWithGoogle } = useAuth();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);

  const handleGoogleSuccess = async (credentialResponse: { credential?: string }) => {
    if (!credentialResponse.credential) {
      alertApiError(null, "Google sign-in didn't return a credential.");
      return;
    }
    setBusy(true);
    try {
      const user = await loginWithGoogle(credentialResponse.credential);
      alertToast(`Welcome, ${user.name || "user"}!`, "success");
      navigate(getPostLoginRedirect(user.role), { replace: true });
    } catch (err) {
      alertApiError(err, "Google sign-in failed.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mt-6">
      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-gray-200"></div>
        </div>
        <div className="relative flex justify-center text-sm">
          <span className="px-4 bg-white text-gray-500">Or continue with</span>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-3">
        {/* Google Login */}
        <div className={busy ? "pointer-events-none opacity-60" : undefined}>
          <GoogleLogin
            onSuccess={handleGoogleSuccess}
            onError={() => alertApiError(null, "Google sign-in failed.")}
            width="100%"
            text="continue_with"
          />
        </div>

        {/* Apple Login — no credential configured yet */}
        <button
          type="button"
          disabled
          title="Apple sign-in is coming soon"
          className="w-full inline-flex justify-center items-center gap-2 py-2.5 px-4 border border-gray-300 rounded-md shadow-sm bg-gray-50 text-sm font-medium text-gray-400 cursor-not-allowed"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
            <path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09l.01-.01zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z" />
          </svg>
          Apple
        </button>
      </div>
    </div>
  );
};
