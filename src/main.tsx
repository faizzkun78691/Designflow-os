import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AuthProvider } from "./contexts/AuthContext";
import { ThemeProvider } from "./contexts/ThemeContext";
import {
  getMissingSupabaseEnv,
  isSupabaseConfigured,
} from "./integrations/supabase/client";
import { ConfigErrorScreen } from "./pages/auth/ConfigError";
import { Toaster } from "./components/ui/toaster";
import { router } from "./app/router";
import "./index.css";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 30_000,
      refetchOnWindowFocus: false,
    },
  },
});

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    {isSupabaseConfigured() ? (
      <QueryClientProvider client={queryClient}>
        <ThemeProvider>
          <AuthProvider>
            <RouterProvider router={router} />
            <Toaster />
          </AuthProvider>
        </ThemeProvider>
      </QueryClientProvider>
    ) : (
      <ConfigErrorScreen missing={getMissingSupabaseEnv()} />
    )}
  </StrictMode>,
);
