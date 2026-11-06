import React, { useEffect, useMemo, useState } from "react";
import { BrowserRouter, Routes, Route, Navigate, useLocation, useNavigate } from "react-router-dom";

import NotFound404 from "../pages/NotFound404";
import MainMenu from "../pages/MainMenu";
import Register from "../pages/Register";
import Login from "../pages/Login";
import SignInCode from "../pages/SignInCode";
import Profile from "../pages/Profile";
import AdminMenu from "../pages/AdminMenu";
import SupportChat from "../pages/SupportChat";
import Navbar from "../widgets/Navbar/index";
import Footer from "../widgets/Footer";
import About from "../pages/About";
import UserAgreement from "../pages/UserAgreement";
import PublicOffer from "../pages/PublicOffer";
import { useAuth } from "./auth/AuthContext";
import Basket from "../pages/Basket";
import Cooperation from "../pages/Cooperation";
import SearchPage from "../pages/Search";
import OrdersPage from "../pages/Orders";
import SteamRefillPage from "../pages/SteamRefill";
import IndividualOrderPayment from "../pages/IndividualOrder/Payment";
import SellerChat from "../pages/SellerChat";
import OrderChat from "../pages/OrderChat";
import Review from "../pages/Review";
import ResetPassword from "../pages/ResetPassword";
import FAQ from "../pages/FAQ";
import { ProfileSetupModal } from "../widgets/ProfileSetupModal";
import { Spinner } from "../shared/ui/Spinner/Spinner";
import PageFade from "../shared/fx/PageFade";
import AstraAvatarDefs from "../shared/brand/AstraAvatarDefs";
import { PaymentLauncher } from "../widgets/PaymentDialog";

const isProfileComplete = (user) => {
    if (!user) return false;
    // Минимум: nickname и timezone (можно расширить позже)
    return Boolean(user.nickname) && Boolean(user.timezone);
};

/** Опт-in к поведению React Router v7 — убирает предупреждения в консоли. */
const routerFuture = {
    v7_startTransition: true,
    v7_relativeSplatPath: true,
};

function App() {
    const { isAuthenticated, isLoading, user, loadUserProfile } = useAuth();
    const [isProfileSetupOpen, setIsProfileSetupOpen] = useState(false);
    const alreadyComplete = useMemo(() => isProfileComplete(user), [user]);

    useEffect(() => {
        if (!isAuthenticated) {
            setIsProfileSetupOpen(false);
            return;
        }
        setIsProfileSetupOpen(!alreadyComplete);
    }, [isAuthenticated, alreadyComplete]);


    if (isLoading) {
        return (
            <div style={{ minHeight: "60vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Spinner color="#E2799B" size={44} label="Загрузка..." />
            </div>
        );
    }

    return (
        <div className="app">

            {/* Карта маршрутов:
                menu (корень), search, support, about, user-agreement,
                public-offer, coop, basket (открыта гостю),
                sign_in / sign_in/code / sign_up,
                profile, orders, order-chat/:orderId, steam-refill,
                admin-panel, seller-chat, 404.

                Страниц товара и подкатегории НЕТ: и то и другое живёт
                в попапе быстрой покупки. */}

            <BrowserRouter future={routerFuture}>
                <AppRoutes
                    isAuthenticated={isAuthenticated}
                    user={user}
                    isProfileSetupOpen={isProfileSetupOpen}
                    setIsProfileSetupOpen={setIsProfileSetupOpen}
                    loadUserProfile={loadUserProfile}
                />
            </BrowserRouter>
        </div>
    );
}

export default App;

const AppRoutes = ({ isAuthenticated, user, isProfileSetupOpen, setIsProfileSetupOpen, loadUserProfile }) => {
    const navigate = useNavigate();
    const location = useLocation();

    // useEffect(() => {
    //     window.scrollTo(0, 0);
    // }, [location.pathname]);
    useEffect(() => { // скролл элементов
        document.getElementById("root")?.scrollTo({
            top: 0,
            behavior: "auto", // или "instant", если поддерживается
        });
        // Реальный скроллер — окно: без этого переход между страницами
        // оставляет прокрутку на старой позиции.
        window.scrollTo({ top: 0, behavior: "auto" });
    }, [location.pathname]);

    return (
        <>
            <AstraAvatarDefs />
            <PaymentLauncher />
            {/* Кросс-фейд смены маршрута (#14). PageFade живёт ВНУТРИ роутера
                (использует useLocation) и оборачивает целиком <Routes>, а не
                каждую страницу. Уходящий кадр — инертный СНИМОК разметки
                внутри PageFade, поэтому замораживать location не нужно и
                покидаемая страница не монтируется повторно. */}
            <PageFade>
                <Routes>
                    <Route path="/individual-order/payment" element={<><Navbar /><IndividualOrderPayment /><Footer /></>} />
                    <Route
                        path="/sign_up"
                        element={
                            <>
                                <Register />
                                <Footer />
                            </>
                        }
                    />

                    <Route
                        path="/reset-password"
                        element={
                            <>
                                <ResetPassword />
                                <Footer />
                            </>
                        }
                    />
                    
                    <Route
                        path="/sign_in"
                        element={
                            <>
                                <Login />
                                <Footer />
                            </>
                        }
                    />
                    <Route
                        path="/sign_in/code"
                        element={
                            <>
                                <SignInCode />
                                <Footer />
                            </>
                        }
                    />

                    <Route
                        path="/main"
                        element={
                            <>
                                <Navbar />
                                <MainMenu />
                                <Footer />
                            </>
                        }
                    />

                    <Route
                        path="/search"
                        element={
                            <>
                                <Navbar />
                                <SearchPage />
                                <Footer />
                            </>
                        }
                    />

                    <Route
                        path="/support"
                        element={
                            <>
                                <Navbar />
                                <SupportChat />
                                <Footer />
                            </>
                        }
                    />

                    <Route
                        path="/profile"
                        element={
                            isAuthenticated ? (
                                <>
                                    <Navbar />
                                    <Profile />
                                    <Footer />
                                </>
                            ) : (
                                <Navigate to="/sign_in" replace />
                            )
                        }
                    />

                    <Route
                        path="/steam-refill"
                        element={
                            isAuthenticated ? (
                                <>
                                    <Navbar />
                                    <SteamRefillPage />
                                    <Footer />
                                </>
                            ) : (
                                <Navigate to="/sign_in" replace />
                            )
                        }
                    />

                    <Route
                        path="/orders"
                        element={
                            isAuthenticated ? (
                                <>
                                    <Navbar />
                                    <OrdersPage />
                                    <Footer />
                                </>
                            ) : (
                                <Navigate to="/sign_in" replace />
                            )
                        }
                    />

                    <Route
                        path="/order-chat/:orderId"
                        element={
                            isAuthenticated ? (
                                <>
                                    <Navbar />
                                    <OrderChat />
                                    <Footer />
                                </>
                            ) : (
                                <Navigate to="/sign_in" replace />
                            )
                        }
                    />

                    {/* /product/:id и /category/:categoryId сняты (#4, #17):
                        товар и подкатегории открываются попапом быстрой покупки
                        (widgets/CategoryQuickBuy), отдельных страниц больше нет.
                        Старые ссылки падают в 404 — маршрутов-призраков не держим. */}

                    <Route
                        path="/about"
                        element={
                            <>
                                <Navbar />
                                <About />
                                <Footer />
                            </>
                        }
                    />

                    <Route
                        path="/user-agreement"
                        element={
                            <>
                                <Navbar />
                                <UserAgreement />
                                <Footer />
                            </>
                        }
                    />

                    <Route
                        path="/public-offer"
                        element={
                            <>
                                <Navbar />
                                <PublicOffer />
                                <Footer />
                            </>
                        }
                    />

                    <Route
                        path="/coop"
                        element={
                            <>
                                <Navbar />
                                <Cooperation />
                                <Footer />
                            </>
                        }
                    />

                    {/* Корзина доступна БЕЗ аккаунта (#12): гость собирает заказ и
                        видит итог; вход требуется только на шаге оформления —
                        гостевой сценарий живёт внутри самой страницы. */}
                    <Route
                        path="/basket"
                        element={
                            <>
                                <Navbar />
                                <Basket />
                                <Footer />
                            </>
                        }
                    />

                    <Route
                        path="/admin-panel"
                        element={
                            isAuthenticated && user?.role === "admin" ? (
                                <>
                                    <Navbar />
                                    <AdminMenu />
                                </>
                            ) : (
                                <Navigate to="/main" replace />
                            )
                        }
                    />

                    <Route
                        path="/seller-chat"
                        element={
                            isAuthenticated && (user?.role === "seller" || user?.role === "admin" || user?.role === "moderator") ? (
                                <>
                                    <Navbar />
                                    <SellerChat />
                                    <Footer />
                                </>
                            ) : (
                                <Navigate to="/main" replace />
                            )
                        }
                    />

                    <Route
                        path="/review"
                        element={
                            <>
                                <Navbar />
                                <Review />
                                <Footer />
                            </>
                        }
                    />

                    <Route
                        path="/faq"
                        element={
                            <>
                                <Navbar />
                                <FAQ />
                                <Footer />
                            </>
                        }
                    />

                    <Route path="/" element={<Navigate to={"/main"} replace />} />
                    <Route
                        path="*"
                        element={
                            <>
                                <Navbar />
                                <NotFound404 />
                                <Footer />
                            </>
                        }
                    />
                </Routes>
            </PageFade>

            <ProfileSetupModal
                isOpen={isProfileSetupOpen}
                user={user}
                onDone={async () => {
                    await loadUserProfile?.();
                    setIsProfileSetupOpen(false);
                    if (location.pathname.startsWith("/sign_")) {
                        navigate("/main", { replace: true });
                    }
                }}
                onClose={() => setIsProfileSetupOpen(false)}
            />
        </>
    );
};
