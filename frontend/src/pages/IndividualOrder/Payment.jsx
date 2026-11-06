import React, { useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../../app/auth/AuthContext";
import { getApiErrorMessage } from "../../shared/commonApi";
import GlassLensDefs from "../../shared/fx/LiquidGlass";
import { clearPaidIndividualOrder } from "../MainMenu/IndividualOrder";
import { getIndividualOrder, payIndividualOrder, openIndividualOrderPayment } from "../../entities/individualOrder/api/individualOrderApi";
import "../MainMenu/main_menu.css";

const IndividualOrderPayment = () => {
    const location = useLocation();
    const navigate = useNavigate();
    const { isAuthenticated } = useAuth();
    const params = new URLSearchParams(location.search);
    const publicId = params.get("order");
    const failed = params.get("failed") === "1";
    const [order, setOrder] = useState(null);
    const [error, setError] = useState("");
    const [paying, setPaying] = useState(false);
    const [checking, setChecking] = useState(false);
    const [attempt, setAttempt] = useState(0);
    const busy = useRef(false);

    useEffect(() => {
        if (!isAuthenticated || !publicId) return undefined;
        let cancelled = false;
        let timer;
        let checks = 0;
        setChecking(true);
        setError("");
        const check = async () => {
            try {
                const current = await getIndividualOrder(publicId);
                if (cancelled) return;
                setOrder(current);
                if (current.is_paid) {
                    clearPaidIndividualOrder(current.public_id);
                    navigate(`/order-chat/${current.id}`, { replace: true });
                    return;
                }
                checks += 1;
                if (!failed && current.status === "created" && checks < 20) timer = window.setTimeout(check, 3000);
                else setChecking(false);
            } catch (err) {
                if (!cancelled) { setError(getApiErrorMessage(err)); setChecking(false); }
            }
        };
        check();
        return () => { cancelled = true; window.clearTimeout(timer); };
    }, [isAuthenticated, publicId, failed, attempt, navigate]);

    const pay = async () => {
        if (busy.current || !order) return;
        busy.current = true;
        setPaying(true);
        setError("");
        try {
            const payment = await payIndividualOrder(order.public_id);
            if (["paid", "processing", "completed"].includes(payment.status)) {
                setAttempt((value) => value + 1);
                return;
            }
            openIndividualOrderPayment(payment);
        } catch (err) { setError(getApiErrorMessage(err)); }
        finally { busy.current = false; setPaying(false); }
    };

    return <main className="main-menu mm-root"><GlassLensDefs /><div className="mm-page">
        <section className="mm-steam astra-liquid mm-individual" aria-labelledby="individual-payment-title">
            <h1 className="astra-h mm-steam-title" id="individual-payment-title">Индивидуальный заказ</h1>
            {!isAuthenticated ? <p className="mm-steam-sub"><Link to="/sign_in" className="mm-rules-link">Войдите в аккаунт</Link>, чтобы открыть свою заявку.</p>
                : !publicId ? <p className="mm-field-error">Не указан номер заявки.</p> : <>
                    {order && <p className="mm-steam-sub">Заявка {order.public_id}. Оформление — <span className="mm-steam-total">1 ₽</span>.</p>}
                    <p className="mm-steam-sub" role="status">{order?.status === "canceled" ? "Заявка отменена. Для нового заказа заполните форму ещё раз." : failed ? "Оплата не завершена. Вы можете повторить её для этой же заявки." : checking ? "Ожидаем подтверждение оплаты. После подтверждения откроется чат с продавцом." : "Подтверждение оплаты пока не получено. Если вы уже оплатили заявку, проверьте статус ещё раз."}</p>
                    {error && <p className="mm-field-error" role="alert">{error}</p>}
                    <div className="mm-steam-foot">
                        <button className="astra-btn-ghost astra-press" type="button" onClick={() => setAttempt((value) => value + 1)}>Проверить оплату</button>
                        {order?.status === "created" && <button className="astra-btn" type="button" disabled={paying} onClick={pay}>{paying ? "Подготовка оплаты…" : "Оплатить заявку — 1 ₽"}</button>}
                    </div>
                </>}
            <p className="mm-field-hint">Стоимость самой услуги согласуем в чате. Продавец отправит отдельную ссылку на оплату Robokassa.</p>
            <Link className="mm-rules-link" to="/orders">Мои заказы</Link>
        </section>
    </div></main>;
};

export default IndividualOrderPayment;
