export interface FormErrors {
  date?: string;
  categoryId?: string;
  amount?: string;
  description?: string;
}

export interface ValidatableExpenseData {
  date: string;
  categoryId: string;
  amount: number;
  description: string;
}

export function validateExpenseForm(data: ValidatableExpenseData): FormErrors {
  const errors: FormErrors = {};

  if (!data.date) {
    errors.date = "日付を入力してください";
  } else {
    const d = new Date(data.date);
    if (isNaN(d.getTime())) errors.date = "正しい日付を入力してください";
  }

  if (!data.categoryId) {
    errors.categoryId = "精算項目を選択してください";
  }

  if (!data.amount || data.amount <= 0) {
    errors.amount = "1円以上の金額を入力してください";
  } else if (data.amount > 10_000_000) {
    errors.amount = "金額は1,000万円以下で入力してください";
  } else if (!Number.isInteger(data.amount)) {
    errors.amount = "金額は整数で入力してください";
  }

  if (!data.description.trim()) {
    errors.description = "内容を入力してください";
  } else if (data.description.trim().length > 1000) {
    errors.description = "内容は1,000文字以内で入力してください";
  }

  return errors;
}
