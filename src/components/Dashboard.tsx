"use client";

import { useState, useEffect, useCallback } from "react";
import { signOut } from "next-auth/react";
import ExpenseModal, { ExpenseFormData } from "./ExpenseModal";

interface ExpenseItem {
  id: string;
  date: string;
  category: string;
  description: string;
  amount: number;
  status: "draft" | "submitted" | "approved" | "rejected";
  submitter: string;
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
  category: { name: string };
  description: string;
  amount: number;
  status: string;
  user: { name: string };
}

const STATUS_CONFIG = {
  draft:     { label: "下書き",   className: "bg-gray-100 text-gray-700" },
  submitted: { label: "承認待ち", className: "bg-yellow-100 text-yellow-800" },
  approved:  { label: "承認済み", className: "bg-green-100 text-green-800" },
  rejected:  { label: "却下",    className: "bg-red-100 text-red-800" },
};

// API sortBy field → API param mapping
const SORT_FIELD_MAP: Record<string, string> = {
  date:        "expenseDate",
  category:    "expenseDate", // no category sort in API; fall back
  description: "expenseDate",
  amount:      "amount",
  status:      "status",
  submitter:   "expenseDate",
};

export default function Dashboard() {
  const [expenses, setExpenses]     = useState<ExpenseItem[]>([]);
  const [isLoading, setIsLoading]   = useState(true);
  const [categories, setCategories] = useState<Category[]>([]);

  const [filterStatus,     setFilterStatus]     = useState<string>("all");
  const [filterCategoryId, setFilterCategoryId] = useState<string>("all");
  const [page,             setPage]             = useState(1);
  const [pagination, setPagination] = useState<Pagination>({ page: 1, limit: 10, total: 0, totalPages: 1 });

  const [sortField,  setSortField]  = useState<keyof ExpenseItem>("date");
  const [sortOrder,  setSortOrder]  = useState<"asc" | "desc">("desc");

  const [totals, setTotals] = useState({ today: 0, month: 0, year: 0 });
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Fetch categories for filter dropdown
  useEffect(() => {
    fetch("/api/expenses/categories")
      .then((res) => res.json())
      .then((data) => { if (data.success) setCategories(data.data); })
      .catch(() => {});
  }, []);

  // Fetch aggregate totals (today / this month / this year)
  const fetchTotals = useCallback(() => {
    const now   = new Date();
    const today = now.toISOString().split("T")[0];
    const firstOfMonth = `${today.slice(0, 7)}-01`;
    const firstOfYear  = `${now.getFullYear()}-01-01`;

    const getSum = (params: URLSearchParams) =>
      fetch(`/api/expenses?${params}`)
        .then((r) => r.json())
        .then((d) => (d.success ? d.data.summary.totalAmount : 0))
        .catch(() => 0);

    Promise.all([
      getSum(new URLSearchParams({ startDate: today, endDate: today, limit: "1" })),
      getSum(new URLSearchParams({ startDate: firstOfMonth, limit: "1" })),
      getSum(new URLSearchParams({ startDate: firstOfYear,  limit: "1" })),
    ]).then(([todayTotal, monthTotal, yearTotal]) => {
      setTotals({ today: todayTotal, month: monthTotal, year: yearTotal });
    });
  }, []);

  useEffect(() => { fetchTotals(); }, [fetchTotals]);

  // Fetch expense list
  const fetchExpenses = useCallback(() => {
    setIsLoading(true);
    const params = new URLSearchParams({
      page:      page.toString(),
      limit:     "10",
      sortBy:    SORT_FIELD_MAP[sortField] ?? "expenseDate",
      sortOrder: sortOrder,
    });
    if (filterStatus     !== "all") params.set("status",     filterStatus);
    if (filterCategoryId !== "all") params.set("categoryId", filterCategoryId);

    fetch(`/api/expenses?${params}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          const items: ExpenseItem[] = data.data.expenses.map((e: ApiExpense) => ({
            id:          e.id,
            date:        e.expenseDate.split("T")[0],
            category:    e.category.name,
            description: e.description,
            amount:      e.amount,
            status:      e.status as ExpenseItem["status"],
            submitter:   e.user.name,
          }));
          setExpenses(items);
          setPagination(data.data.pagination);
        }
      })
      .catch(() => {})
      .finally(() => setIsLoading(false));
  }, [filterStatus, filterCategoryId, page, sortField, sortOrder]);

  useEffect(() => { fetchExpenses(); }, [fetchExpenses]);

  // Reset to page 1 when filters change
  useEffect(() => { setPage(1); }, [filterStatus, filterCategoryId]);

  // New expense handler
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

    // Refresh list and totals
    fetchExpenses();
    fetchTotals();
  };

  // Sort handler
  const handleSort = (field: keyof ExpenseItem) => {
    if (sortField === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortOrder("asc");
    }
  };

  const getStatusBadge = (status: string) => {
    const config = STATUS_CONFIG[status as keyof typeof STATUS_CONFIG] ?? STATUS_CONFIG.draft;
    return (
      <span className={`px-2 py-1 text-xs font-medium rounded-full ${config.className}`}>
        {config.label}
      </span>
    );
  };

  const SortIcon = ({ field }: { field: keyof ExpenseItem }) =>
    sortField === field ? (
      <svg
        className={`w-4 h-4 ${sortOrder === "asc" ? "rotate-180" : ""}`}
        fill="none" stroke="currentColor" viewBox="0 0 24 24"
      >
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
      </svg>
    ) : null;

  return (
    <div className="min-h-screen bg-gray-50">
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
                onClick={() => setIsModalOpen(true)}
                className="bg-white text-green-600 px-4 py-2 rounded-lg font-semibold hover:bg-green-50 transition-colors duration-200 flex items-center gap-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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

              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center">
                  <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
                  </svg>
                </div>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* メインコンテンツ */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
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
            <table className="min-w-full divide-y divide-gray-200">
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
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                    >
                      <div className="flex items-center gap-1">
                        {label}
                        <SortIcon field={field} />
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {isLoading ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-8 text-center text-sm text-gray-500">
                      読み込み中...
                    </td>
                  </tr>
                ) : expenses.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-8 text-center text-sm text-gray-500">
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
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* ページネーション */}
          {pagination.totalPages > 1 && (
            <div className="px-6 py-4 flex items-center justify-between border-t border-gray-200">
              <p className="text-sm text-gray-700">
                全 {pagination.total} 件中 {(pagination.page - 1) * pagination.limit + 1}–
                {Math.min(pagination.page * pagination.limit, pagination.total)} 件表示
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="px-3 py-1 text-sm border border-gray-300 rounded-md disabled:opacity-40 hover:bg-gray-50"
                >
                  前へ
                </button>
                <span className="px-3 py-1 text-sm text-gray-700">
                  {page} / {pagination.totalPages}
                </span>
                <button
                  onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))}
                  disabled={page === pagination.totalPages}
                  className="px-3 py-1 text-sm border border-gray-300 rounded-md disabled:opacity-40 hover:bg-gray-50"
                >
                  次へ
                </button>
              </div>
            </div>
          )}
        </div>

        {/* 合計金額 */}
        <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white p-6 rounded-lg shadow-sm border-l-4 border-green-500">
            <div className="flex items-center">
              <svg className="w-8 h-8 text-green-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
              <svg className="w-8 h-8 text-blue-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
              <svg className="w-8 h-8 text-purple-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">今年の合計</p>
                <p className="text-2xl font-bold text-gray-900">¥{totals.year.toLocaleString()}</p>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* 交通費精算モーダル */}
      <ExpenseModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSubmit={handleNewExpense}
      />
    </div>
  );
}
