"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";

// ---- 型定義 ----
type ToastType = "success" | "error" | "info";

interface ToastItem {
  id: number;
  type: ToastType;
  message: string;
}

interface ToastContextValue {
  showToast: (message: string, type?: ToastType) => void;
}

// ---- Context ----
const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used inside ToastProvider");
  return ctx;
}

// ---- アイコン ----
function ToastIcon({ type }: { type: ToastType }) {
  if (type === "success") {
    return (
      <svg
        className="w-5 h-5 text-green-500 flex-shrink-0"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
        aria-hidden="true"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M5 13l4 4L19 7"
        />
      </svg>
    );
  }
  if (type === "error") {
    return (
      <svg
        className="w-5 h-5 text-red-500 flex-shrink-0"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
        aria-hidden="true"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
        />
      </svg>
    );
  }
  return (
    <svg
      className="w-5 h-5 text-blue-500 flex-shrink-0"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
      />
    </svg>
  );
}

const TOAST_BG: Record<ToastType, string> = {
  success: "bg-white border-green-400",
  error:   "bg-white border-red-400",
  info:    "bg-white border-blue-400",
};

// ---- 個別トースト ----
function ToastCard({
  item,
  onDismiss,
}: {
  item: ToastItem;
  onDismiss: (id: number) => void;
}) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    timerRef.current = setTimeout(() => onDismiss(item.id), 4000);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [item.id, onDismiss]);

  return (
    <div
      role="alert"
      className={`flex items-start gap-3 w-80 px-4 py-3 rounded-lg shadow-lg border-l-4 ${TOAST_BG[item.type]} animate-fade-in`}
    >
      <ToastIcon type={item.type} />
      <p className="flex-1 text-sm text-gray-800 leading-snug">{item.message}</p>
      <button
        onClick={() => onDismiss(item.id)}
        aria-label="通知を閉じる"
        className="flex-shrink-0 text-gray-400 hover:text-gray-600 transition-colors"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
}

// ---- Provider ----
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const nextId = useRef(0);

  const showToast = useCallback((message: string, type: ToastType = "info") => {
    const id = ++nextId.current;
    setToasts((prev) => [...prev, { id, type, message }]);
  }, []);

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      {/* aria-live で読み上げ通知（エラーは assertive, 他は polite） */}
      <div
        aria-live="assertive"
        aria-atomic="true"
        className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 items-end"
      >
        {toasts
          .filter((t) => t.type === "error")
          .map((t) => (
            <ToastCard key={t.id} item={t} onDismiss={dismiss} />
          ))}
      </div>
      <div
        aria-live="polite"
        aria-atomic="true"
        className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 items-end"
        style={{ bottom: toasts.filter((t) => t.type === "error").length * 72 + 16 }}
      >
        {toasts
          .filter((t) => t.type !== "error")
          .map((t) => (
            <ToastCard key={t.id} item={t} onDismiss={dismiss} />
          ))}
      </div>
    </ToastContext.Provider>
  );
}
