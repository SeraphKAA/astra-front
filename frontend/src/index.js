import React from "react";
import { createRoot } from "react-dom/client";
import "./app/styles.css";
import App from "./app";
import { AuthProvider } from "./app/auth/AuthProvider";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ToastProvider } from "./shared/ui/Toast/ToastProvider";
import { UnreadProvider } from "./app/unread/UnreadContext";

/* ------------------------------------------------------------------
   Модальность ввода (owner: поля не должны подсвечиваться по клику).
   :focus-visible для этого не годится: по спецификации он ВСЕГДА совпадает
   с текстовым полем, даже если в него ткнули мышью, — поэтому кольцо
   появлялось всё равно. Помечаем корень тем, чем пользователь работает
   прямо сейчас, и рисуем кольцо только в клавиатурном режиме.
   ------------------------------------------------------------------ */
const setModality = (mode) => {
    /* Пишем только при смене режима: атрибут питает :root[…]-селектор,
       и переустановка на каждый pointerdown заставляла бы пересчитывать
       совпадения впустую. */
    const html = document.documentElement;
    if (html.dataset.modality !== mode) html.dataset.modality = mode;
};
setModality("mouse");
window.addEventListener("pointerdown", () => setModality("mouse"), true);
window.addEventListener(
    "keydown",
    (e) => {
        /* только навигационные клавиши: набор текста режим не меняет */
        if (e.key === "Tab" || (e.key && e.key.startsWith("Arrow")) || e.key === "Home" || e.key === "End") {
            setModality("keyboard");
        }
    },
    true
);

const queryClient = new QueryClient();
const container = document.getElementById("root");
const root = createRoot(container);

root.render(
    <React.StrictMode>
        <AuthProvider>
            <ToastProvider>
                <UnreadProvider>
                    <QueryClientProvider client={queryClient}>
                        <App />
                    </QueryClientProvider>
                </UnreadProvider>
            </ToastProvider>
        </AuthProvider>
    </React.StrictMode>
);
