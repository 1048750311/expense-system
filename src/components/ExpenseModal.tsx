"use client";

import { useState, useEffect, useRef } from "react";
import { validateExpenseForm, type FormErrors } from "@/lib/validateExpense";

interface Category {
  id: string;
  name: string;
  code: string;
}

export interface InitialExpenseData {
  date: string;
  categoryId: string;
  category: string;
  transportation: string;
  tripType: "one-way" | "round-trip";
  receipt: "yes" | "no";
  amount: number;
  description: string;
  receiptPath?: string;
}

interface ExpenseModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: ExpenseFormData) => Promise<void>;
  /** 編集モード時に渡す既存データ。未指定なら新規登録モード */
  initialData?: InitialExpenseData;
}

export interface ExpenseFormData {
  date: string;
  categoryId: string;
  category: string;
  transportation: string;
  tripType: "one-way" | "round-trip";
  receipt: "yes" | "no";
  amount: number;
  description: string;
  file?: File;
}

const transportationOptions = [
  { value: "train", label: "電車" },
  { value: "bus",   label: "バス" },
  { value: "car",   label: "作業車" },
  { value: "other", label: "その他" },
];

const MAX_FILE_SIZE = 5 * 1024 * 1024;
const ALLOWED_TYPES = ["image/jpeg", "image/png", "application/pdf"];

const BLANK_FORM: ExpenseFormData = {
  date:           new Date().toISOString().split("T")[0],
  categoryId:     "",
  category:       "",
  transportation: "train",
  tripType:       "one-way",
  receipt:        "yes",
  amount:         0,
  description:    "",
};

function FieldError({ message, id }: { message?: string; id?: string }) {
  if (!message) return null;
  return <p id={id} className="mt-1 text-sm text-red-600" role="alert">{message}</p>;
}

function inputCls(hasError?: string) {
  return `w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent ${
    hasError ? "border-red-400 bg-red-50" : "border-gray-300"
  }`;
}

/** URLが画像かどうか判定 */
function isImageUrl(url: string) {
  return /\.(jpe?g|png|gif|webp)/i.test(url);
}

/** URLがPDFかどうか判定 */
function isPdfUrl(url: string) {
  return /\.pdf/i.test(url);
}

export default function ExpenseModal({
  isOpen,
  onClose,
  onSubmit,
  initialData,
}: ExpenseModalProps) {
  const isEditMode = !!initialData;

  const dateInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef  = useRef<HTMLInputElement>(null);

  const [categories,   setCategories]   = useState<Category[]>([]);
  const [formData,     setFormData]     = useState<ExpenseFormData>(BLANK_FORM);
  const [formErrors,   setFormErrors]   = useState<FormErrors>({});
  const [file,         setFile]         = useState<File | null>(null);
  const [previewUrl,   setPreviewUrl]   = useState<string | null>(null);
  const [isDragOver,   setIsDragOver]   = useState(false);
  const [fileError,    setFileError]    = useState<string>("");
  const [submitError,  setSubmitError]  = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // モーダルが開いたら日付フィールドにフォーカス
  useEffect(() => {
    if (isOpen) {
      const timer = setTimeout(() => dateInputRef.current?.focus(), 100);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  // モーダルが開くたびにフォームを初期化
  useEffect(() => {
    if (!isOpen) return;
    setFormErrors({});
    setSubmitError("");
    setFileError("");
    setFile(null);
    setPreviewUrl(null);
    setIsDragOver(false);

    if (initialData) {
      setFormData({
        date:           initialData.date,
        categoryId:     initialData.categoryId,
        category:       initialData.category,
        transportation: initialData.transportation,
        tripType:       initialData.tripType,
        receipt:        initialData.receipt,
        amount:         initialData.amount,
        description:    initialData.description,
      });
    } else {
      setFormData({ ...BLANK_FORM, date: new Date().toISOString().split("T")[0] });
    }
  }, [isOpen]); // eslint-disable-line react-hooks/exhaustive-deps

  // BlobURL クリーンアップ
  useEffect(() => {
    return () => {
      if (previewUrl?.startsWith("blob:")) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  // ★ ウィンドウ全体のドラッグをブロック（ブラウザがファイルを開くのを防ぐ）
  useEffect(() => {
    if (!isOpen) return;
    const prevent = (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
    };
    window.addEventListener("dragover", prevent);
    window.addEventListener("drop", prevent);
    return () => {
      window.removeEventListener("dragover", prevent);
      window.removeEventListener("drop", prevent);
    };
  }, [isOpen]);

  // カテゴリをAPIから取得
  useEffect(() => {
    if (!isOpen) return;
    fetch("/api/expenses/categories")
      .then((res) => res.json())
      .then((data) => {
        if (data.success && data.data.length > 0) {
          setCategories(data.data);
          if (!isEditMode) {
            setFormData((prev) => ({
              ...prev,
              categoryId: prev.categoryId || data.data[0].id,
              category:   prev.category   || data.data[0].name,
            }));
          }
        }
      })
      .catch(() => {});
  }, [isOpen, isEditMode]);

  const clearFieldError = (field: keyof FormErrors) =>
    setFormErrors((prev) => ({ ...prev, [field]: undefined }));

  const handleInputChange = (field: keyof ExpenseFormData, value: string | number) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (field === "date")        clearFieldError("date");
    if (field === "amount")      clearFieldError("amount");
    if (field === "description") clearFieldError("description");
  };

  const handleCategoryChange = (categoryId: string) => {
    const selected = categories.find((c) => c.id === categoryId);
    setFormData((prev) => ({ ...prev, categoryId, category: selected?.name ?? "" }));
    clearFieldError("categoryId");
  };

  /** ファイルのバリデーション＋プレビューURL設定 */
  const processFile = (selected: File) => {
    setFileError("");
    if (!ALLOWED_TYPES.includes(selected.type)) {
      setFileError("jpg、png、pdf のみアップロードできます");
      return;
    }
    if (selected.size > MAX_FILE_SIZE) {
      setFileError(
        `ファイルサイズは5MB以下にしてください（現在: ${(selected.size / 1024 / 1024).toFixed(1)}MB）`
      );
      return;
    }
    // 古いBlobURLを解放
    if (previewUrl?.startsWith("blob:")) URL.revokeObjectURL(previewUrl);

    setFile(selected);
    if (selected.type === "image/jpeg" || selected.type === "image/png") {
      setPreviewUrl(URL.createObjectURL(selected));
    } else {
      setPreviewUrl(null);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (selected) processFile(selected);
    // 同じファイルを再選択できるようにリセット
    e.target.value = "";
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    const selected = e.dataTransfer.files?.[0];
    if (selected) processFile(selected);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const errors = validateExpenseForm(formData);
    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }
    if (fileError) return;

    setSubmitError("");
    setIsSubmitting(true);
    try {
      await onSubmit({ ...formData, file: file ?? undefined });
      onClose();
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "処理に失敗しました");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    if (!isSubmitting) onClose();
  };

  // Escape キーでモーダルを閉じる
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") handleClose();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, isSubmitting]);

  if (!isOpen) return null;

  // 編集モードの既存領収書
  const existingReceiptUrl = isEditMode ? (initialData?.receiptPath ?? null) : null;

  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
    >
      <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
        <div className="fixed inset-0 transition-opacity" aria-hidden="true">
          <div className="absolute inset-0 bg-gray-500 opacity-75" onClick={handleClose} />
        </div>

        <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
          <form onSubmit={handleSubmit} noValidate>
            {/* ヘッダー */}
            <div className="bg-gradient-to-r from-green-500 to-green-600 px-6 py-4">
              <h3 id="modal-title" className="text-lg font-medium text-white">
                {isEditMode ? "交通費精算編集" : "交通費精算登録"}
              </h3>
            </div>

            {/* フォーム内容 */}
            <div className="px-6 py-6 space-y-6">
              {submitError && (
                <div className="bg-red-50 border border-red-300 text-red-700 px-4 py-3 rounded-md text-sm">
                  {submitError}
                </div>
              )}

              {/* 月日 */}
              <div>
                <label htmlFor="date" className="block text-sm font-medium text-gray-700 mb-2">
                  月日 <span className="text-red-500" aria-hidden="true">*</span>
                </label>
                <input
                  ref={dateInputRef}
                  type="date"
                  id="date"
                  value={formData.date}
                  onChange={(e) => handleInputChange("date", e.target.value)}
                  className={inputCls(formErrors.date)}
                  aria-required="true"
                  aria-invalid={!!formErrors.date}
                  aria-describedby={formErrors.date ? "date-error" : undefined}
                />
                <FieldError message={formErrors.date} id="date-error" />
              </div>

              {/* 精算項目 */}
              <div>
                <label htmlFor="category" className="block text-sm font-medium text-gray-700 mb-2">
                  精算項目 <span className="text-red-500" aria-hidden="true">*</span>
                </label>
                <select
                  id="category"
                  value={formData.categoryId}
                  onChange={(e) => handleCategoryChange(e.target.value)}
                  className={inputCls(formErrors.categoryId)}
                  aria-required="true"
                  aria-invalid={!!formErrors.categoryId}
                  aria-describedby={formErrors.categoryId ? "category-error" : undefined}
                >
                  {categories.length === 0 && <option value="">読み込み中...</option>}
                  {categories.map((cat) => (
                    <option key={cat.id} value={cat.id}>{cat.name}</option>
                  ))}
                </select>
                <FieldError message={formErrors.categoryId} id="category-error" />
              </div>

              {/* 交通手段 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">交通手段</label>
                <div className="space-y-2">
                  {transportationOptions.map((opt) => (
                    <label key={opt.value} className="flex items-center cursor-pointer">
                      <input
                        type="radio"
                        name="transportation"
                        value={opt.value}
                        checked={formData.transportation === opt.value}
                        onChange={(e) => handleInputChange("transportation", e.target.value)}
                        className="h-4 w-4 text-green-600 focus:ring-green-500 border-gray-300"
                      />
                      <span className="ml-2 text-sm text-gray-700">{opt.label}</span>
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
                  金額（円） <span className="text-red-500" aria-hidden="true">*</span>
                </label>
                <input
                  type="number"
                  id="amount"
                  value={formData.amount || ""}
                  onChange={(e) => handleInputChange("amount", parseInt(e.target.value) || 0)}
                  className={inputCls(formErrors.amount)}
                  placeholder="例: 1200"
                  min="1"
                  aria-required="true"
                  aria-invalid={!!formErrors.amount}
                  aria-describedby={formErrors.amount ? "amount-error" : undefined}
                />
                <FieldError message={formErrors.amount} id="amount-error" />
              </div>

              {/* 内容 */}
              <div>
                <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-2">
                  内容 <span className="text-red-500" aria-hidden="true">*</span>
                </label>
                <textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => handleInputChange("description", e.target.value)}
                  rows={3}
                  className={inputCls(formErrors.description)}
                  placeholder="精算内容を入力してください"
                  maxLength={1000}
                  aria-required="true"
                  aria-invalid={!!formErrors.description}
                  aria-describedby={formErrors.description ? "description-error" : undefined}
                />
                <div className="flex justify-between items-start mt-1">
                  <FieldError message={formErrors.description} id="description-error" />
                  <span className="text-xs text-gray-400 ml-auto">
                    {formData.description.length}/1000
                  </span>
                </div>
              </div>

              {/* ── 新規登録: ファイルアップロードエリア ── */}
              {!isEditMode && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    添付ファイル（領収書）
                  </label>

                  {/* hidden input は常に存在 */}
                  <input
                    ref={fileInputRef}
                    id="file"
                    name="file"
                    type="file"
                    className="sr-only"
                    accept="image/jpeg,image/png,application/pdf"
                    onChange={handleFileChange}
                  />

                  <div
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                    className={`border-2 border-dashed rounded-lg transition-all ${
                      fileError
                        ? "border-red-300 bg-red-50"
                        : isDragOver
                        ? "border-green-400 bg-green-50 scale-[1.01]"
                        : "border-gray-300 hover:border-green-400"
                    }`}
                  >
                    {previewUrl ? (
                      /* 画像プレビュー */
                      <div className="flex flex-col items-center gap-3 p-4">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={previewUrl}
                          alt="プレビュー"
                          className="max-h-52 w-full rounded-md border border-gray-200 object-contain bg-gray-50"
                        />
                        <div className="flex items-center gap-3">
                          <p className="text-sm text-gray-700 font-medium truncate max-w-[200px]">{file?.name}</p>
                          <button
                            type="button"
                            onClick={() => fileInputRef.current?.click()}
                            className="text-xs text-green-600 hover:text-green-700 underline shrink-0"
                          >
                            変更
                          </button>
                          <button
                            type="button"
                            onClick={() => { setFile(null); setPreviewUrl(null); setFileError(""); }}
                            className="text-xs text-red-500 hover:text-red-600 underline shrink-0"
                          >
                            削除
                          </button>
                        </div>
                      </div>
                    ) : file ? (
                      /* PDF選択済み */
                      <div className="flex items-center gap-3 px-4 py-5">
                        <svg className="h-10 w-10 text-red-400 shrink-0" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
                          <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd" />
                        </svg>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-gray-700 font-medium truncate">{file.name}</p>
                          <p className="text-xs text-gray-400">{(file.size / 1024).toFixed(0)} KB</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => fileInputRef.current?.click()}
                          className="text-xs text-green-600 hover:text-green-700 underline shrink-0"
                        >
                          変更
                        </button>
                        <button
                          type="button"
                          onClick={() => { setFile(null); setPreviewUrl(null); setFileError(""); }}
                          className="text-xs text-red-500 hover:text-red-600 underline shrink-0"
                        >
                          削除
                        </button>
                      </div>
                    ) : (
                      /* 未選択: クリックまたはドラッグ */
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="w-full flex flex-col items-center gap-2 px-6 py-8 cursor-pointer focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-inset rounded-lg"
                      >
                        <svg className="h-10 w-10 text-gray-300" stroke="currentColor" fill="none" viewBox="0 0 48 48" aria-hidden="true">
                          <path d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                        <span className="text-sm text-gray-500">
                          <span className="font-medium text-green-600">ファイルを選択</span>
                          {" "}またはドラッグ＆ドロップ
                        </span>
                        <span className="text-xs text-gray-400">JPG・PNG・PDF　最大5MB</span>
                      </button>
                    )}
                  </div>

                  {fileError && (
                    <p className="mt-1 text-sm text-red-600">{fileError}</p>
                  )}
                </div>
              )}

              {/* ── 編集モード: 既存領収書を最下部に表示 ── */}
              {isEditMode && (
                <div>
                  <p className="block text-sm font-medium text-gray-700 mb-2">添付ファイル（領収書）</p>
                  {existingReceiptUrl ? (
                    isImageUrl(existingReceiptUrl) ? (
                      /* 画像 */
                      <div className="rounded-lg border border-gray-200 overflow-hidden bg-gray-50">
                        <a href={existingReceiptUrl} target="_blank" rel="noopener noreferrer" title="クリックで拡大表示">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={existingReceiptUrl}
                            alt="領収書"
                            className="w-full max-h-64 object-contain hover:opacity-90 transition-opacity cursor-zoom-in"
                          />
                        </a>
                        <div className="px-3 py-2 border-t border-gray-200 bg-white flex items-center justify-between">
                          <span className="text-xs text-gray-500">クリックで拡大表示</span>
                          <a
                            href={existingReceiptUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-green-600 hover:text-green-700 underline"
                          >
                            新しいタブで開く
                          </a>
                        </div>
                      </div>
                    ) : isPdfUrl(existingReceiptUrl) ? (
                      /* PDF */
                      <a
                        href={existingReceiptUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-3 px-4 py-3 border border-gray-200 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors"
                      >
                        <svg className="h-8 w-8 text-red-400 shrink-0" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
                          <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd" />
                        </svg>
                        <span className="text-sm text-gray-700">PDFを開く</span>
                        <svg className="h-4 w-4 text-gray-400 ml-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                        </svg>
                      </a>
                    ) : (
                      <a href={existingReceiptUrl} target="_blank" rel="noopener noreferrer" className="text-sm text-green-600 underline">
                        ファイルを開く
                      </a>
                    )
                  ) : (
                    <p className="text-sm text-gray-400 italic">添付ファイルなし</p>
                  )}
                </div>
              )}
            </div>

            {/* フッター */}
            <div className="bg-gray-50 px-6 py-4 flex justify-end space-x-3">
              <button
                type="button"
                onClick={handleClose}
                disabled={isSubmitting}
                className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                キャンセル
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting ? (isEditMode ? "更新中..." : "登録中...") : (isEditMode ? "更新" : "登録")}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
