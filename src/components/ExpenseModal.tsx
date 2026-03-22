"use client";

import { useState, useEffect } from "react";

interface Category {
  id: string;
  name: string;
  code: string;
}

interface ExpenseModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: ExpenseFormData) => Promise<void>;
}

export interface ExpenseFormData {
  date: string;
  categoryId: string;
  category: string; // 表示用カテゴリ名
  transportation: string;
  tripType: "one-way" | "round-trip";
  receipt: "yes" | "no";
  amount: number;
  description: string;
  file?: File;
}

interface FormErrors {
  date?: string;
  categoryId?: string;
  amount?: string;
  description?: string;
}

const transportationOptions = [
  { value: "train", label: "電車" },
  { value: "bus",   label: "バス" },
  { value: "car",   label: "作業車" },
  { value: "other", label: "その他" },
];

const MAX_FILE_SIZE   = 5 * 1024 * 1024; // 5MB
const ALLOWED_TYPES   = ["image/jpeg", "image/png", "application/pdf"];

const INITIAL_FORM: ExpenseFormData = {
  date:           new Date().toISOString().split("T")[0],
  categoryId:     "",
  category:       "",
  transportation: "train",
  tripType:       "one-way",
  receipt:        "yes",
  amount:         0,
  description:    "",
};

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="mt-1 text-sm text-red-600">{message}</p>;
}

function inputClass(hasError?: string) {
  return `w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent ${
    hasError ? "border-red-400 bg-red-50" : "border-gray-300"
  }`;
}

export default function ExpenseModal({ isOpen, onClose, onSubmit }: ExpenseModalProps) {
  const [categories,   setCategories]   = useState<Category[]>([]);
  const [formData,     setFormData]     = useState<ExpenseFormData>(INITIAL_FORM);
  const [formErrors,   setFormErrors]   = useState<FormErrors>({});
  const [file,         setFile]         = useState<File | null>(null);
  const [fileError,    setFileError]    = useState<string>("");
  const [submitError,  setSubmitError]  = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMsg,   setSuccessMsg]   = useState<string>("");

  // カテゴリをAPIから取得
  useEffect(() => {
    if (!isOpen) return;
    fetch("/api/expenses/categories")
      .then((res) => res.json())
      .then((data) => {
        if (data.success && data.data.length > 0) {
          setCategories(data.data);
          setFormData((prev) => ({
            ...prev,
            categoryId: data.data[0].id,
            category:   data.data[0].name,
          }));
        }
      })
      .catch(() => {});
  }, [isOpen]);

  const clearFieldError = (field: keyof FormErrors) => {
    setFormErrors((prev) => ({ ...prev, [field]: undefined }));
  };

  const handleInputChange = (field: keyof ExpenseFormData, value: string | number) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (field in ({} as FormErrors)) clearFieldError(field as keyof FormErrors);
    // clear relevant errors when user types
    if (field === "date")        clearFieldError("date");
    if (field === "amount")      clearFieldError("amount");
    if (field === "description") clearFieldError("description");
  };

  const handleCategoryChange = (categoryId: string) => {
    const selected = categories.find((c) => c.id === categoryId);
    setFormData((prev) => ({
      ...prev,
      categoryId,
      category: selected?.name ?? "",
    }));
    clearFieldError("categoryId");
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFileError("");
    const selected = e.target.files?.[0];
    if (!selected) return;

    if (!ALLOWED_TYPES.includes(selected.type)) {
      setFileError("jpg、png、pdf のみアップロードできます");
      e.target.value = "";
      return;
    }
    if (selected.size > MAX_FILE_SIZE) {
      setFileError(
        `ファイルサイズは5MB以下にしてください（現在: ${(selected.size / 1024 / 1024).toFixed(1)}MB）`
      );
      e.target.value = "";
      return;
    }
    setFile(selected);
  };

  // クライアントサイドバリデーション
  const validateForm = (): FormErrors => {
    const errors: FormErrors = {};

    if (!formData.date) {
      errors.date = "日付を入力してください";
    } else {
      const selected = new Date(formData.date);
      const minDate  = new Date("2000-01-01");
      const maxDate  = new Date();
      maxDate.setFullYear(maxDate.getFullYear() + 1);
      if (isNaN(selected.getTime())) {
        errors.date = "正しい日付を入力してください";
      } else if (selected < minDate || selected > maxDate) {
        errors.date = "有効な日付を入力してください";
      }
    }

    if (!formData.categoryId) {
      errors.categoryId = "精算項目を選択してください";
    }

    if (!formData.amount || formData.amount <= 0) {
      errors.amount = "1円以上の金額を入力してください";
    } else if (formData.amount > 10_000_000) {
      errors.amount = "金額は1,000万円以下で入力してください";
    } else if (!Number.isInteger(formData.amount)) {
      errors.amount = "金額は整数で入力してください";
    }

    if (!formData.description.trim()) {
      errors.description = "内容を入力してください";
    } else if (formData.description.trim().length > 1000) {
      errors.description = "内容は1,000文字以内で入力してください";
    }

    return errors;
  };

  const resetForm = (cats: Category[]) => {
    setFormData({
      ...INITIAL_FORM,
      date:       new Date().toISOString().split("T")[0],
      categoryId: cats[0]?.id   ?? "",
      category:   cats[0]?.name ?? "",
    });
    setFile(null);
    setFormErrors({});
    setFileError("");
    setSubmitError("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // バリデーション実行
    const errors = validateForm();
    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }

    // ファイルエラーがあれば送信しない
    if (fileError) return;

    setSubmitError("");
    setSuccessMsg("");
    setIsSubmitting(true);

    try {
      await onSubmit({ ...formData, file: file ?? undefined });
      setSuccessMsg("登録が完了しました");
      setTimeout(() => {
        onClose();
        resetForm(categories);
        setSuccessMsg("");
      }, 800);
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "登録に失敗しました");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    if (!isSubmitting) {
      resetForm(categories);
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
        <div className="fixed inset-0 transition-opacity" aria-hidden="true">
          <div className="absolute inset-0 bg-gray-500 opacity-75" onClick={handleClose}></div>
        </div>

        <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
          <form onSubmit={handleSubmit} noValidate>
            {/* ヘッダー */}
            <div className="bg-gradient-to-r from-green-500 to-green-600 px-6 py-4">
              <h3 className="text-lg font-medium text-white">交通費精算登録</h3>
            </div>

            {/* フォーム内容 */}
            <div className="px-6 py-6 space-y-6">
              {/* 成功メッセージ */}
              {successMsg && (
                <div className="bg-green-50 border border-green-300 text-green-700 px-4 py-3 rounded-md text-sm flex items-center gap-2">
                  <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  {successMsg}
                </div>
              )}

              {/* APIエラーメッセージ */}
              {submitError && (
                <div className="bg-red-50 border border-red-300 text-red-700 px-4 py-3 rounded-md text-sm">
                  {submitError}
                </div>
              )}

              {/* 月日 */}
              <div>
                <label htmlFor="date" className="block text-sm font-medium text-gray-700 mb-2">
                  月日 <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  id="date"
                  value={formData.date}
                  onChange={(e) => handleInputChange("date", e.target.value)}
                  className={inputClass(formErrors.date)}
                />
                <FieldError message={formErrors.date} />
              </div>

              {/* 精算項目 */}
              <div>
                <label htmlFor="category" className="block text-sm font-medium text-gray-700 mb-2">
                  精算項目 <span className="text-red-500">*</span>
                </label>
                <select
                  id="category"
                  value={formData.categoryId}
                  onChange={(e) => handleCategoryChange(e.target.value)}
                  className={inputClass(formErrors.categoryId)}
                >
                  {categories.length === 0 && (
                    <option value="">読み込み中...</option>
                  )}
                  {categories.map((cat) => (
                    <option key={cat.id} value={cat.id}>{cat.name}</option>
                  ))}
                </select>
                <FieldError message={formErrors.categoryId} />
              </div>

              {/* 交通手段 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">交通手段</label>
                <div className="space-y-2">
                  {transportationOptions.map((option) => (
                    <label key={option.value} className="flex items-center cursor-pointer">
                      <input
                        type="radio"
                        name="transportation"
                        value={option.value}
                        checked={formData.transportation === option.value}
                        onChange={(e) => handleInputChange("transportation", e.target.value)}
                        className="h-4 w-4 text-green-600 focus:ring-green-500 border-gray-300"
                      />
                      <span className="ml-2 text-sm text-gray-700">{option.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* 片道/往復 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">片道/往復</label>
                <div className="space-y-2">
                  {(["one-way", "round-trip"] as const).map((val) => (
                    <label key={val} className="flex items-center cursor-pointer">
                      <input
                        type="radio"
                        name="tripType"
                        value={val}
                        checked={formData.tripType === val}
                        onChange={(e) => handleInputChange("tripType", e.target.value)}
                        className="h-4 w-4 text-green-600 focus:ring-green-500 border-gray-300"
                      />
                      <span className="ml-2 text-sm text-gray-700">
                        {val === "one-way" ? "片道" : "往復"}
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              {/* 領収書 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">領収書</label>
                <div className="space-y-2">
                  {(["yes", "no"] as const).map((val) => (
                    <label key={val} className="flex items-center cursor-pointer">
                      <input
                        type="radio"
                        name="receipt"
                        value={val}
                        checked={formData.receipt === val}
                        onChange={(e) => handleInputChange("receipt", e.target.value)}
                        className="h-4 w-4 text-green-600 focus:ring-green-500 border-gray-300"
                      />
                      <span className="ml-2 text-sm text-gray-700">
                        {val === "yes" ? "あり" : "なし"}
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              {/* 金額 */}
              <div>
                <label htmlFor="amount" className="block text-sm font-medium text-gray-700 mb-2">
                  金額（円） <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  id="amount"
                  value={formData.amount || ""}
                  onChange={(e) => handleInputChange("amount", parseInt(e.target.value) || 0)}
                  className={inputClass(formErrors.amount)}
                  placeholder="例: 1200"
                  min="1"
                />
                <FieldError message={formErrors.amount} />
              </div>

              {/* 内容 */}
              <div>
                <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-2">
                  内容 <span className="text-red-500">*</span>
                </label>
                <textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => handleInputChange("description", e.target.value)}
                  rows={3}
                  className={inputClass(formErrors.description)}
                  placeholder="精算内容を入力してください（例: 渋谷〜新宿 業務移動）"
                  maxLength={1000}
                />
                <div className="flex justify-between items-start mt-1">
                  <FieldError message={formErrors.description} />
                  <span className="text-xs text-gray-400 ml-auto">
                    {formData.description.length}/1000
                  </span>
                </div>
              </div>

              {/* 添付ファイル */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  添付ファイル（領収書）
                </label>
                <div
                  className={`mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-dashed rounded-md transition-colors ${
                    fileError ? "border-red-300" : "border-gray-300 hover:border-gray-400"
                  }`}
                >
                  <div className="space-y-1 text-center">
                    <svg
                      className="mx-auto h-12 w-12 text-gray-400"
                      stroke="currentColor"
                      fill="none"
                      viewBox="0 0 48 48"
                      aria-hidden="true"
                    >
                      <path
                        d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02"
                        strokeWidth={2}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                    <div className="flex text-sm text-gray-600 justify-center">
                      <label
                        htmlFor="file"
                        className="relative cursor-pointer bg-white rounded-md font-medium text-green-600 hover:text-green-500 focus-within:outline-none focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-green-500"
                      >
                        <span>ファイルを選択</span>
                        <input
                          id="file"
                          name="file"
                          type="file"
                          className="sr-only"
                          accept="image/jpeg,image/png,application/pdf"
                          onChange={handleFileChange}
                        />
                      </label>
                      <p className="pl-1">またはドラッグ＆ドロップ</p>
                    </div>
                    <p className="text-xs text-gray-500">JPG、PNG、PDF　最大5MB</p>
                    {file && (
                      <p className="text-sm text-green-600 font-medium">選択済み: {file.name}</p>
                    )}
                    {fileError && (
                      <p className="text-sm text-red-600">{fileError}</p>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* フッター */}
            <div className="bg-gray-50 px-6 py-4 flex justify-end space-x-3">
              <button
                type="button"
                onClick={handleClose}
                disabled={isSubmitting}
                className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                戻る
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting ? "登録中..." : "登録"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
