/**
 * File: src/App.tsx
 * App root: wires global providers (React Query + Auth) around the router.
 */

import { RouterProvider } from "react-router";
import { QueryClientProvider } from "@tanstack/react-query";
import { GoogleOAuthProvider } from "@react-oauth/google";

import "./App.css";
import { route } from "./router/router";
import { queryClient } from "./lib/queryClient";
import AuthProvider from "./context/AuthProvider";
import { ErrorBoundary } from "./components/error/ErrorBoundary";
import { AppToastContainer } from "./components/ui/AppToast";

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || "";

function App() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
          <AuthProvider>
            <RouterProvider router={route} />
            <AppToastContainer />
          </AuthProvider>
        </GoogleOAuthProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

export default App;
