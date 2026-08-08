import React, { useEffect, useMemo, useState } from "react";
import { BrowserRouter, Routes, Route, Navigate, useLocation, useNavigate } from "react-router-dom";

import NotFound404 from "../pages/NotFound404";
import MainMenu from "../pages/MainMenu";
import Register from "../pages/Register";
import Login from "../pages/Login";
import SignInCode from "../pages/SignInCode";
import Product from "../pages/Product";
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
import CategoryPage from "../pages/Category";
import OrdersPage from "../pages/Orders";
import SteamRefillPage from "../pages/SteamRefill";
import SellerChat from "../pages/SellerChat";
import OrderChat from "../pages/OrderChat";
import { ProfileSetupModal } from "../widgets/ProfileSetupModal";
import { Spinner } from "../shared/ui/Spinner/Spinner";

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

// import { LS } from "../utilities/utilLocalStorage";

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

            {/* 
                sign_in
                sign_up
                category ???
                basket
                support
                profile
                referal
                order
                promocode
                coop

                menu (main root)
                404
            */}

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
    }, [location.pathname]);

    return (
        <>
            <Routes>
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
                    path="/menu"
                    element={
                        <>
                            <Navbar />
                            <MainMenu />
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

                <Route
                    path="/product/:id"
                    element={
                        <>
                            <Navbar />
                            <Product />
                            <Footer />
                        </>
                    }
                />

                <Route
                    path="/category/:categoryId"
                    element={
                        <>
                            <Navbar />
                            <CategoryPage />
                            <Footer />
                        </>
                    }
                />

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

                <Route
                    path="/basket"
                    element={
                        isAuthenticated ? (
                            <>
                                <Navbar />
                                <Basket />
                                <Footer />
                            </>
                        ) : (
                            <Navigate to="/sign_in" replace />
                        )
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
                            <Navigate to="/menu" replace />
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
                            <Navigate to="/menu" replace />
                        )
                    }
                />

                <Route path="/" element={<Navigate to={"/menu"} replace />} />
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

            <ProfileSetupModal
                isOpen={isProfileSetupOpen}
                user={user}
                onDone={async () => {
                    await loadUserProfile?.();
                    setIsProfileSetupOpen(false);
                    if (location.pathname.startsWith("/sign_")) {
                        navigate("/menu", { replace: true });
                    }
                }}
                onClose={() => setIsProfileSetupOpen(false)}
            />
        </>
    );
};
