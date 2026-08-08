
export const LS = {
    get: async (key) => {
        return await localStorage.getItem(key);
    },

    set: async (key, value) => {
        localStorage.setItem(key, value);
        return await { key: value };

    },

    remove: async (key) => {
        localStorage.removeItem(key);
        return;
    },

    clear: async () => {
        localStorage.clear();
        return;
    }
}