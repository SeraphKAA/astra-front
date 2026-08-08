import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Infinite scroll: loads pages via fetchPage({ page, size }) and appends items.
 * @param {object} options
 * @param {(args: { page: number, size: number }) => Promise<{ items: unknown[], pages?: number }>} options.fetchPage
 * @param {number} [options.pageSize=20]
 * @param {unknown} [options.resetKey] — сброс при смене (например categoryId)
 */
export function useInfiniteScroll({ fetchPage, pageSize = 20, resetKey }) {
    const [items, setItems] = useState([]);
    const [page, setPage] = useState(1);
    const [pages, setPages] = useState(1);
    const [loading, setLoading] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);
    const [error, setError] = useState("");
    const [sentinelEl, setSentinelEl] = useState(null);
    const loadingMoreRef = useRef(false);
    const pageRef = useRef(1);
    const pagesRef = useRef(1);
    const loadPageRef = useRef(null);

    pageRef.current = page;
    pagesRef.current = pages;

    const hasMore = page < pages;

    const loadPage = useCallback(
        async (targetPage, append) => {
            if (append) {
                if (loadingMoreRef.current) return;
                loadingMoreRef.current = true;
                setLoadingMore(true);
            } else {
                setLoading(true);
                setError("");
            }
            try {
                const data = await fetchPage({ page: targetPage, size: pageSize });
                const nextItems = Array.isArray(data?.items)
                    ? data.items
                    : Array.isArray(data?.products)
                      ? data.products
                      : [];
                const nextPages = data?.pages ?? 1;
                setPages(nextPages);
                setPage(targetPage);
                setItems((prev) => (append ? [...prev, ...nextItems] : nextItems));
            } catch (e) {
                if (!append) {
                    setItems([]);
                    setPages(1);
                    setPage(1);
                }
                setError(e?.message || "Не удалось загрузить данные");
            } finally {
                if (append) {
                    loadingMoreRef.current = false;
                    setLoadingMore(false);
                } else {
                    setLoading(false);
                }
            }
        },
        [fetchPage, pageSize]
    );

    loadPageRef.current = loadPage;

    const sentinelRef = useCallback((node) => {
        setSentinelEl(node);
    }, []);

    useEffect(() => {
        setItems([]);
        setPage(1);
        setPages(1);
        loadPage(1, false);
    }, [resetKey, loadPage]);

    useEffect(() => {
        if (!sentinelEl || !hasMore || loading) return undefined;

        const observer = new IntersectionObserver(
            (entries) => {
                if (!entries.some((entry) => entry.isIntersecting)) return;
                if (loadingMoreRef.current) return;
                if (pageRef.current >= pagesRef.current) return;
                loadPageRef.current?.(pageRef.current + 1, true);
            },
            { rootMargin: "200px", threshold: 0 }
        );
        observer.observe(sentinelEl);
        return () => observer.disconnect();
    }, [sentinelEl, hasMore, loading]);

    return {
        items,
        loading,
        loadingMore,
        error,
        hasMore,
        sentinelRef,
    };
}
