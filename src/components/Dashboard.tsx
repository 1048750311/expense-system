"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { signOut } from "next-auth/react";
import ExpenseModal, { ExpenseFormData, InitialExpenseData } from "./ExpenseModal";
import { useToast } from "./Toast";

interface ExpenseItem {
  id: string;
  date: string;
  categoryId: string;
  category: string;
  description: string;
  amount: number;
  status: "draft" | "submitted" | "approved" | "rejected";
  submitter: string;
  transportation: string;
  tripType: "one-way" | "round-trip";
  receipt: "yes" | "no";
}

interface Category {
  id: string;
  name: string;
  code: string;
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

interface ApiExpense {
  id: string;
  expenseDate: string;
  category: { id: string; name: string };
  description: string;
  amount: number;
  status: string;
  user: { name: string };
  transportType: string | null;
  roundTrip: boolean;
  receiptStatus: string;
}

const STATUS_CONFIG = {
  draft:     { label: "下書き",   className: "bg-gray-100 text-gray-700" },
  submitted: { label: "承認待ち", className: "bg-yellow-100 text-yellow-800" },
  approved:  { label: "承認済み", className: "bg-green-100 text-green-800" },
  rejected:  { label: "却下",    className: "bg-red-100 text-red-800" },
};

const SORT_FIELD_MAP: Record<string, string> = {
  date:        "expenseDate",
  category:    "expenseDate",
  amount:      "amount",
  status:      "status",
  submitter:   "expenseDate",
  description: "expenseDate",
};

function toTripType(roundTrip: boolean): "one-way" | "round-trip" {
  return roundTrip ? "round-trip" : "one-way";
}

function toReceipt(receiptStatus: string): "yes" | "no" {
  return receiptStatus !== "none" ? "yes" : "no";
}

export default function Dashboard() {
  const { showToast } = useToast();

  const [expenses,     setExpenses]     = useState<ExpenseItem[]>([]);
  const [isLoading,    setIsLoading]    = useState(true);
  const [categories,   setCategories]   = useState<Category[]>([]);

  const [filterStatus,     setFilterStatus]     = useState<string>("all");
  const [filterCategoryId, setFilterCategoryId] = useState<string>("all");
  const [page,             setPage]             = useState(1);
  const [pagination, setPagination] = useState<Pagination>({ page: 1, limit: 10, total: 0, totalPages: 1 });

  const [sortField, setSortField] = useState<keyof ExpenseItem>("date");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

  const [totals, setTotals] = useState({ today: 0, month: 0, year: 0 });
  const [isTotalsLoading, setIsTotalsLoading] = useState(true);

  // 削除ダイアログのキャンセルボタンref（フォーカス管理用）
  const deleteCancelRef = useRef<HTMLButtonElement>(null);

  // モーダル状態
  const [isNewModalOpen,  setIsNewModalOpen]  = useState(false);
  const [editingExpense,  setEditingExpense]  = useState<ExpenseItem | null>(null);

  // 削除確認ダイアログ状態
  const [deletingExpense, setDeletingExpense] = useState<ExpenseItem | null>(null);
  const [isDeleting,      setIsDeleting]      = useState(false);
  const [deleteError,     setDeleteError]     = useState<string>("");

  // カテゴリ取得
  useEffect(() => {
    fetch("/api/expenses/categories")
      .then((r) => r.json())
      .then((d) => { if (d.success) setCategories(d.data); })
      .catch(() => showToast("カテゴリの取得に失敗しました", "error"));
  }, [showToast]);

  // 合計金額取得
  const fetchTotals = useCallback(() => {
    setIsTotalsLoading(true);
    const now          = new Date();
    const today        = now.toISOString().split("T")[0];
    const firstOfMonth = `${today.slice(0, 7)}-01`;
    const firstOfYear  = `${now.getFullYear()}-01-01`;

    const getSum = (params: URLSearchParams) =>
      fetch(`/api/expenses?${params}`)
        .then((r) => r.json())
        .then((d) => (d.success ? d.data.summary.totalAmount : 0))
        .catch(() => 0);

    Promise.all([
      getSum(new URLSearchParams({ startDate: today,        endDate: today, limit: "1" })),
      getSum(new URLSearchParams({ startDate: firstOfMonth, limit: "1" })),
      getSum(new URLSearchParams({ startDate: firstOfYear,  limit: "1" })),
    ]).then(([todayTotal, monthTotal, yearTotal]) => {
      setTotals({ today: todayTotal, month: monthTotal, year: yearTotal });
      setIsTotalsLoading(false);
    });
  }, []);

  useEffect(() => { fetchTotals(); }, [fetchTotals]);

  // 一覧取得
  const fetchExpenses = useCallback(() => {
    setIsLoading(true);
    const params = new URLSearchParams({
      page:      page.toString(),
      limit:     "10",
      sortBy:    SORT_FIELD_MAP[sortField as string] ?? "expenseDate",
      sortOrder: sortOrder,
    });
    if (filterStatus     !== "all") params.set("status",     filterStatus);
    if (filterCategoryId !== "all") params.set("categoryId", filterCategoryId);

    fetch(`/api/expenses?${params}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.success) {
          const items: ExpenseItem[] = d.data.expenses.map((e: ApiExpense) => ({
            id:             e.id,
            date:           e.expenseDate.split("T")[0],
            categoryId:     e.category.id,
            category:       e.category.name,
            description:    e.description,
            amount:         e.amount,
            status:         e.status as ExpenseItem["status"],
            submitter:      e.user.name,
            transportation: e.transportType ?? "other",
            tripType:       toTripType(e.roundTrip),
            receipt:        toReceipt(e.receiptStatus),
          }));
          setExpenses(items);
          setPagination(d.data.pagination);
        }
      })
      .catch(() => showToast("データの取得に失敗しました", "error"))
      .finally(() => setIsLoading(false));
  }, [filterStatus, filterCategoryId, page, sortField, sortOrder, showToast]);

  useEffect(() => { fetchExpenses(); }, [fetchExpenses]);
  useEffect(() => { setPage(1); }, [filterStatus, filterCategoryId]);

  // 削除ダイアログが開いたらキャンセルボタンにフォーカス
  useEffect(() => {
    if (deletingExpense) {
      const timer = setTimeout(() => deleteCancelRef.current?.focus(), 50);
      return () => clearTimeout(timer);
    }
  }, [deletingExpense]);

  // ---- 新規登録 ----
  const handleNewExpense = async (formData: ExpenseFormData) => {
    let receiptPath: string | undefined;
    let receiptStatus: "none" | "available" | "uploaded" =
      formData.receipt === "yes" ? "available" : "none";

    if (formData.file) {
      const uploadForm = new FormData();
      uploadForm.append("file", formData.file);
      const uploadRes  = await fetch("/api/expenses/upload", { method: "POST", body: uploadForm });
      const uploadData = await uploadRes.json();
      if (!uploadRes.ok) throw new Error(uploadData.error || "ファイルのアップロードに失敗しました");
      receiptPath   = uploadData.data.path;
      receiptStatus = "uploaded";
    }

    const res  = await fetch("/api/expenses", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        categoryId:    formData.categoryId,
        description:   formData.description,
        amount:        formData.amount,
        expenseDate:   formData.date,
        transportType: formData.transportation,
        roundTrip:     formData.tripType === "round-trip",
        receiptStatus,
        receiptPath,
      }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "登録に失敗しました");

    showToast("精算データを登録しました", "success");
    fetchExpenses();
    fetchTotals();
  };

  // ---- 編集 ----
  const handleEditSubmit = async (formData: ExpenseFormData) => {
    if (!editingExpense) return;

    const res  = await fetch(`/api/expenses/${editingExpense.id}`, {
      method:  "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        categoryId:    formData.categoryId,
        description:   formData.description,
        amount:        formData.amount,
        expenseDate:   formData.date,
        transportType: formData.transportation,
        roundTrip:     formData.tripType === "round-trip",
        receiptStatus: formData.receipt === "yes" ? "available" : "none",
      }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "更新に失敗しました");

    showToast("精算データを更新しました", "success");
    setEditingExpense(null);
    fetchExpenses();
    fetchTotals();
  };

  // ---- 削除 ----
  const handleDeleteConfirm = async () => {
    if (!deletingExpense) return;
    setIsDeleting(true);
    setDeleteError("");

    const res  = await fetch(`/api/expenses/${deletingExpense.id}`, { method: "DELETE" });
    const data = await res.json();

    if (!res.ok) {
      setDeleteError(data.error || "削除に失敗しました");
      setIsDeleting(false);
      return;
    }

    showToast("精算データを削除しました", "success");
    setDeletingExpense(null);
    setIsDeleting(false);
    fetchExpenses();
    fetchTotals();
  };

  // ---- ソート ----
  const handleSort = (field: keyof ExpenseItem) => {
    if (sortField === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortOrder("asc");
    }
  };

  const getStatusBadge = (status: string) => {
    const cfg = STATUS_CONFIG[status as keyof typeof STATUS_CONFIG] ?? STATUS_CONFIG.draft;
    return (
      <span className={`px-2 py-1 text-xs font-medium rounded-full ${cfg.className}`}>
        {cfg.label}
      </span>
    );
  };

  const SortIcon = ({ field }: { field: keyof ExpenseItem }) =>
    sortField === field ? (
      <svg
        className={`w-4 h-4 inline-block ${sortOrder === "asc" ? "rotate-180" : ""}`}
        fill="none" stroke="currentColor" viewBox="0 0 24 24"
      >
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
      </svg>
    ) : null;

  // 編集モーダルに渡す initialData
  const editInitialData: InitialExpenseData | undefined = editingExpense
    ? {
        date:           editingExpense.date,
        categoryId:     editingExpense.categoryId,
        category:       editingExpense.category,
        transportation: editingExpense.transportation,
        tripType:       editingExpense.tripType,
        receipt:        editingExpense.receipt,
        amount:         editingExpense.amount,
        description:    editingExpense.description,
      }
    : undefined;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* スキップナビゲーション */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:bg-white focus:px-4 focus:py-2 focus:rounded-md focus:text-green-600 focus:font-semibold focus:shadow-md"
      >
        コンテンツへスキップ
      </a>

      {/* ヘッダー */}
      <header className="bg-gradient-to-r from-green-500 to-green-600 text-white shadow-lg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div>
              <h1 className="text-2xl font-bold">Bridge System</h1>
              <p className="text-green-100 text-sm">精算一覧</p>
            </div>
            <div className="flex items-center space-x-4">
              <button
                onClick={() => setIsNewModalOpen(true)}
                className="bg-white text-green-600 px-4 py-2 rounded-lg font-semibold hover:bg-green-50 transition-colors duration-200 flex items-center gap-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                新規登録
              </button>
              <button
                onClick={() => signOut({ callbackUrl: "/login" })}
                className="bg-white text-red-600 px-4 py-2 rounded-lg font-semibold hover:bg-red-50 transition-colors duration-200"
              >
                ログアウト
              </button>
              <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center">
                <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
                </svg>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* メインコンテンツ */}
      <main id="main-content" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* フィルター */}
        <div className="mb-6 flex flex-col sm:flex-row gap-4">
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 mb-2">ステータス</label>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="w-full sm:w-auto px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
            >
              <option value="all">すべて</option>
              <option value="draft">下書き</option>
              <option value="submitted">承認待ち</option>
              <option value="approved">承認済み</option>
              <option value="rejected">却下</option>
            </select>
          </div>
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 mb-2">カテゴリ</label>
            <select
              value={filterCategoryId}
              onChange={(e) => setFilterCategoryId(e.target.value)}
              className="w-full sm:w-auto px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
            >
              <option value="all">すべて</option>
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>{cat.name}</option>
              ))}
            </select>
          </div>
        </div>

        {/* テーブル */}
        <div className="bg-white shadow-sm rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200" aria-label="精算一覧">
              <thead className="bg-gray-50">
                <tr>
                  {(
                    [
                      { field: "date" as const,        label: "日付" },
                      { field: "category" as const,    label: "カテゴリ" },
                      { field: "description" as const, label: "内容" },
                      { field: "amount" as const,      label: "金額" },
                      { field: "status" as const,      label: "ステータス" },
                      { field: "submitter" as const,   label: "申請者" },
                    ] as const
                  ).map(({ field, label }) => (
                    <th
                      key={field}
                      onClick={() => handleSort(field)}
                      onKeyDown={(e) => e.key === "Enter" && handleSort(field)}
                      tabIndex={0}
                      scope="col"
                      aria-sort={
                        sortField === field
                          ? sortOrder === "asc"
                            ? "ascending"
                            : "descending"
                          : "none"
                      }
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-green-500"
                    >
                      <div className="flex items-center gap-1">
                        {label} <SortIcon field={field} />
                      </div>
                    </th>
                  ))}
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    操作
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200" aria-live="polite" aria-busy={isLoading}>
                {isLoading ? (
                  // スケルトンUI: データ読み込み中
                  Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i} aria-hidden="true">
                      {Array.from({ length: 7 }).map((__, j) => (
                        <td key={j} className="px-6 py-4">
                          <div className="h-4 bg-gray-200 rounded animate-pulse" style={{ width: j === 2 ? "80%" : j === 6 ? "60%" : "70%" }} />
                        </td>
                      ))}
                    </tr>
                  ))
                ) : expenses.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-8 text-center text-sm text-gray-500" role="cell">
                      データがありません
                    </td>
                  </tr>
                ) : (
                  expenses.map((expense) => (
                    <tr key={expense.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {new Date(expense.date).toLocaleDateString("ja-JP")}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {expense.category}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900 max-w-xs truncate">
                        {expense.description}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        ¥{expense.amount.toLocaleString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {getStatusBadge(expense.status)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {expense.submitter}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        <div className="flex justify-end gap-2">
                          {/* 編集ボタン：承認済みは非表示 */}
                          {expense.status !== "approved" && (
                            <button
                              onClick={() => setEditingExpense(expense)}
                              aria-label={`${expense.description} を編集`}
                              className="text-xs px-3 py-1 rounded border border-blue-300 text-blue-600 hover:bg-blue-50 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-400"
                            >
                              編集
                            </button>
                          )}
                          {/* 削除ボタン：承認済みは非表示 */}
                          {expense.status !== "approved" && (
                            <button
                              onClick={() => {
                                setDeleteError("");
                                setDeletingExpense(expense);
                              }}
                              aria-label={`${expense.description} を削除`}
                              className="text-xs px-3 py-1 rounded border border-red-300 text-red-600 hover:bg-red-50 transition-colors focus:outline-none focus:ring-2 focus:ring-red-400"
                            >
                              削除
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* ページネーション */}
          {pagination.totalPages > 1 && (
            <nav aria-label="ページネーション" className="px-6 py-4 flex items-center justify-between border-t border-gray-200">
              <p className="text-sm text-gray-700" aria-live="polite" aria-atomic="true">
                全 {pagination.total} 件中{" "}
                {(pagination.page - 1) * pagination.limit + 1}–
                {Math.min(pagination.page * pagination.limit, pagination.total)} 件表示
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  aria-label="前のページへ"
                  className="px-3 py-1 text-sm border border-gray-300 rounded-md disabled:opacity-40 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-green-500"
                >
                  前へ
                </button>
                <span className="px-3 py-1 text-sm text-gray-700" aria-current="page" aria-label={`${page}ページ目、全${pagination.totalPages}ページ`}>
                  {page} / {pagination.totalPages}
                </span>
                <button
                  onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))}
                  disabled={page === pagination.totalPages}
                  aria-label="次のページへ"
                  className="px-3 py-1 text-sm border border-gray-300 rounded-md disabled:opacity-40 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-green-500"
                >
                  次へ
                </button>
              </div>
            </nav>
          )}
        </div>

        {/* 合計金額 */}
        <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-6" aria-busy={isTotalsLoading} aria-label="合計金額サマリー">
          {isTotalsLoading ? (
            // スケルトンUI: 合計金額読み込み中
            [
              { border: "border-green-500" },
              { border: "border-blue-500" },
              { border: "border-purple-500" },
            ].map((card, i) => (
              <div key={i} className={`bg-white p-6 rounded-lg shadow-sm border-l-4 ${card.border}`} aria-hidden="true">
                <div className="flex items-center gap-4">
                  <div className="w-8 h-8 bg-gray-200 rounded-full animate-pulse flex-shrink-0" />
                  <div className="flex-1 space-y-2">
                    <div className="h-3 bg-gray-200 rounded animate-pulse w-20" />
                    <div className="h-7 bg-gray-200 rounded animate-pulse w-28" />
                  </div>
                </div>
              </div>
            ))
          ) : (
            <>
              <div className="bg-white p-6 rounded-lg shadow-sm border-l-4 border-green-500">
                <div className="flex items-center">
                  <svg className="w-8 h-8 text-green-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-600">本日の合計</p>
                    <p className="text-2xl font-bold text-gray-900">¥{totals.today.toLocaleString()}</p>
                  </div>
                </div>
              </div>
              <div className="bg-white p-6 rounded-lg shadow-sm border-l-4 border-blue-500">
                <div className="flex items-center">
                  <svg className="w-8 h-8 text-blue-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-600">今月の合計</p>
                    <p className="text-2xl font-bold text-gray-900">¥{totals.month.toLocaleString()}</p>
                  </div>
                </div>
              </div>
              <div className="bg-white p-6 rounded-lg shadow-sm border-l-4 border-purple-500">
                <div className="flex items-center">
                  <svg className="w-8 h-8 text-purple-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-600">今年の合計</p>
                    <p className="text-2xl font-bold text-gray-900">¥{totals.year.toLocaleString()}</p>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </main>

      {/* 新規登録モーダル */}
      <ExpenseModal
        isOpen={isNewModalOpen}
        onClose={() => setIsNewModalOpen(false)}
        onSubmit={handleNewExpense}
      />

      {/* 編集モーダル */}
      <ExpenseModal
        isOpen={!!editingExpense}
        onClose={() => setEditingExpense(null)}
        onSubmit={handleEditSubmit}
        initialData={editInitialData}
      />

      {/* 削除確認ダイアログ */}
      {deletingExpense && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-dialog-title"
          aria-describedby="delete-dialog-description"
        >
          <div
            className="absolute inset-0 bg-gray-500 opacity-75"
            onClick={() => !isDeleting && setDeletingExpense(null)}
            aria-hidden="true"
          />
          <div className="relative bg-white rounded-lg shadow-xl p-6 max-w-md w-full mx-4 z-10">
            <div className="flex items-center gap-3 mb-4">
              <div className="flex-shrink-0 w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
                <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                  />
                </svg>
              </div>
              <h3 id="delete-dialog-title" className="text-lg font-semibold text-gray-900">削除の確認</h3>
            </div>

            <p id="delete-dialog-description" className="text-sm text-gray-600 mb-4">
              以下の精算データを削除しますか？この操作は取り消せません。
            </p>

            <div className="bg-gray-50 rounded-md p-3 mb-4 text-sm space-y-1">
              <p>
                <span className="font-medium text-gray-700">日付: </span>
                {new Date(deletingExpense.date).toLocaleDateString("ja-JP")}
              </p>
              <p>
                <span className="font-medium text-gray-700">内容: </span>
                {deletingExpense.description}
              </p>
              <p>
                <span className="font-medium text-gray-700">金額: </span>
                ¥{deletingExpense.amount.toLocaleString()}
              </p>
            </div>

            {deleteError && (
              <div className="mb-4 bg-red-50 border border-red-300 text-red-700 px-3 py-2 rounded text-sm">
                {deleteError}
              </div>
            )}

            <div className="flex justify-end gap-3">
              <button
                ref={deleteCancelRef}
                onClick={() => setDeletingExpense(null)}
                disabled={isDeleting}
                className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                キャンセル
              </button>
              <button
                onClick={handleDeleteConfirm}
                disabled={isDeleting}
                aria-busy={isDeleting}
                className="px-4 py-2 border border-transparent rounded-md text-sm font-medium text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isDeleting ? "削除中..." : "削除する"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
