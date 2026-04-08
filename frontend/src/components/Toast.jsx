import React, { useState, useCallback, useMemo, createContext, useContext } from 'react';

const ToastContext = createContext();

let toastIdCounter = 0;

export function ToastProvider({ children }) {
    const [toasts, setToasts] = useState([]);

    const addToast = useCallback((message, type = 'info', duration = 3500) => {
        const id = ++toastIdCounter;
        setToasts(prev => [...prev, { id, message, type, exiting: false }]);

        setTimeout(() => {
            // Start exit animation
            setToasts(prev => prev.map(t => t.id === id ? { ...t, exiting: true } : t));
            // Remove after animation completes
            setTimeout(() => {
                setToasts(prev => prev.filter(t => t.id !== id));
            }, 300);
        }, duration);

        return id;
    }, []);

    const removeToast = useCallback((id) => {
        setToasts(prev => prev.map(t => t.id === id ? { ...t, exiting: true } : t));
        setTimeout(() => {
            setToasts(prev => prev.filter(t => t.id !== id));
        }, 300);
    }, []);

    const toast = useMemo(() => ({
        success: (msg, dur) => addToast(msg, 'success', dur),
        error: (msg, dur) => addToast(msg, 'error', dur),
        warning: (msg, dur) => addToast(msg, 'warning', dur),
        info: (msg, dur) => addToast(msg, 'info', dur),
    }), [addToast]);

    return (
        <ToastContext.Provider value={toast}>
            {children}
            {/* Toast Container — fixed bottom-center */}
            <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-[9999] flex flex-col items-center gap-2 pointer-events-none w-full max-w-sm px-4">
                {toasts.map(t => (
                    <div
                        key={t.id}
                        onClick={() => removeToast(t.id)}
                        className={`
                            pointer-events-auto cursor-pointer
                            px-4 py-3 rounded-2xl shadow-2xl backdrop-blur-xl
                            text-sm font-bold flex items-center gap-2.5
                            border transition-all duration-300 w-full
                            ${t.exiting
                                ? 'opacity-0 translate-y-4 scale-95'
                                : 'opacity-100 translate-y-0 scale-100 animate-[slideUp_0.3s_ease-out]'
                            }
                            ${t.type === 'success' ? 'bg-emerald-950/90 border-emerald-500/30 text-emerald-200' : ''}
                            ${t.type === 'error'   ? 'bg-red-950/90 border-red-500/30 text-red-200' : ''}
                            ${t.type === 'warning' ? 'bg-amber-950/90 border-amber-500/30 text-amber-200' : ''}
                            ${t.type === 'info'    ? 'bg-indigo-950/90 border-indigo-500/30 text-indigo-200' : ''}
                        `}
                    >
                        <span className="text-base shrink-0">
                            {t.type === 'success' && '✅'}
                            {t.type === 'error' && '❌'}
                            {t.type === 'warning' && '⚠️'}
                            {t.type === 'info' && 'ℹ️'}
                        </span>
                        <span className="flex-1 leading-snug">{t.message}</span>
                    </div>
                ))}
            </div>
        </ToastContext.Provider>
    );
}

export function useToast() {
    const context = useContext(ToastContext);
    if (!context) {
        // Fallback if used outside provider — returns console-only toasts
        return {
            success: (msg) => console.log('[Toast]', msg),
            error: (msg) => console.error('[Toast]', msg),
            warning: (msg) => console.warn('[Toast]', msg),
            info: (msg) => console.log('[Toast]', msg),
        };
    }
    return context;
}
