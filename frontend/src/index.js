import React from "react";
import { createRoot } from "react-dom/client";
import "./app/styles.css";
import App from "./app";
import { AuthProvider } from "./app/auth/AuthProvider";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ToastProvider } from "./shared/ui/Toast/ToastProvider";

const queryClient = new QueryClient();
const container = document.getElementById("root");
const root = createRoot(container);

root.render(
    <React.StrictMode>
        <AuthProvider>
            <ToastProvider>
                <QueryClientProvider client={queryClient}>
                    <App />
                </QueryClientProvider>
            </ToastProvider>
        </AuthProvider>
    </React.StrictMode>
);
