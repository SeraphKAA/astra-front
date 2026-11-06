export const emitCartUpdated = () => {
    if (typeof window !== "undefined") {
        window.dispatchEvent(new Event("astra:cart-updated"));
    }
};