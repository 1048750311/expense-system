import { describe, it, expect } from 'vitest';
import { validateExpenseForm } from '@/lib/validateExpense';

// テスト用の有効なベースデータ
const validData = {
  date: '2026-03-23',
  categoryId: 'cat-001',
  amount: 1000,
  description: '新宿〜渋谷 電車代',
};

describe('validateExpenseForm', () => {
  // =========================================================
  // 日付フィールド
  // =========================================================
  describe('日付フィールド', () => {
    it('正常な日付はエラーなし', () => {
      const errors = validateExpenseForm({ ...validData, date: '2026-03-23' });
      expect(errors.date).toBeUndefined();
    });

    it('過去の日付はエラーなし（過去日付は許可）', () => {
      const errors = validateExpenseForm({ ...validData, date: '2020-01-01' });
      expect(errors.date).toBeUndefined();
    });

    it('日付が空の場合「日付を入力してください」', () => {
      const errors = validateExpenseForm({ ...validData, date: '' });
      expect(errors.date).toBe('日付を入力してください');
    });

    it('不正な日付文字列は「正しい日付を入力してください」', () => {
      const errors = validateExpenseForm({ ...validData, date: 'not-a-date' });
      expect(errors.date).toBe('正しい日付を入力してください');
    });

    it('フォーマット不正の日付は「正しい日付を入力してください」', () => {
      const errors = validateExpenseForm({ ...validData, date: '20260323' });
      expect(errors.date).toBe('正しい日付を入力してください');
    });
  });

  // =========================================================
  // 精算項目フィールド
  // =========================================================
  describe('精算項目フィールド', () => {
    it('有効なカテゴリIDはエラーなし', () => {
      const errors = validateExpenseForm({ ...validData, categoryId: 'cat-001' });
      expect(errors.categoryId).toBeUndefined();
    });

    it('カテゴリが空の場合「精算項目を選択してください」', () => {
      const errors = validateExpenseForm({ ...validData, categoryId: '' });
      expect(errors.categoryId).toBe('精算項目を選択してください');
    });
  });

  // =========================================================
  // 金額フィールド
  // =========================================================
  describe('金額フィールド', () => {
    it('最小金額 (1円) はエラーなし', () => {
      const errors = validateExpenseForm({ ...validData, amount: 1 });
      expect(errors.amount).toBeUndefined();
    });

    it('通常金額はエラーなし', () => {
      const errors = validateExpenseForm({ ...validData, amount: 5000 });
      expect(errors.amount).toBeUndefined();
    });

    it('最大金額 (10,000,000円) はエラーなし', () => {
      const errors = validateExpenseForm({ ...validData, amount: 10_000_000 });
      expect(errors.amount).toBeUndefined();
    });

    it('金額が0の場合「1円以上の金額を入力してください」', () => {
      const errors = validateExpenseForm({ ...validData, amount: 0 });
      expect(errors.amount).toBe('1円以上の金額を入力してください');
    });

    it('負の金額は「1円以上の金額を入力してください」', () => {
      const errors = validateExpenseForm({ ...validData, amount: -1 });
      expect(errors.amount).toBe('1円以上の金額を入力してください');
    });

    it('1,000万円超過は「金額は1,000万円以下で入力してください」', () => {
      const errors = validateExpenseForm({ ...validData, amount: 10_000_001 });
      expect(errors.amount).toBe('金額は1,000万円以下で入力してください');
    });

    it('小数点金額は「金額は整数で入力してください」', () => {
      const errors = validateExpenseForm({ ...validData, amount: 100.5 });
      expect(errors.amount).toBe('金額は整数で入力してください');
    });
  });

  // =========================================================
  // 内容フィールド
  // =========================================================
  describe('内容フィールド', () => {
    it('1文字はエラーなし', () => {
      const errors = validateExpenseForm({ ...validData, description: 'A' });
      expect(errors.description).toBeUndefined();
    });

    it('1000文字はエラーなし（上限ちょうど）', () => {
      const errors = validateExpenseForm({ ...validData, description: 'A'.repeat(1000) });
      expect(errors.description).toBeUndefined();
    });

    it('前後スペースを除いた内容があればエラーなし', () => {
      const errors = validateExpenseForm({ ...validData, description: '  内容  ' });
      expect(errors.description).toBeUndefined();
    });

    it('空文字は「内容を入力してください」', () => {
      const errors = validateExpenseForm({ ...validData, description: '' });
      expect(errors.description).toBe('内容を入力してください');
    });

    it('スペースのみは「内容を入力してください」', () => {
      const errors = validateExpenseForm({ ...validData, description: '   ' });
      expect(errors.description).toBe('内容を入力してください');
    });

    it('1001文字は「内容は1,000文字以内で入力してください」', () => {
      const errors = validateExpenseForm({ ...validData, description: 'A'.repeat(1001) });
      expect(errors.description).toBe('内容は1,000文字以内で入力してください');
    });
  });

  // =========================================================
  // 全フィールドエラー
  // =========================================================
  describe('複数フィールドエラー', () => {
    it('全フィールドが空の場合、全キーにエラーが存在する', () => {
      const errors = validateExpenseForm({
        date: '',
        categoryId: '',
        amount: 0,
        description: '',
      });
      expect(errors.date).toBeDefined();
      expect(errors.categoryId).toBeDefined();
      expect(errors.amount).toBeDefined();
      expect(errors.description).toBeDefined();
    });

    it('全フィールドが正常な場合、エラーオブジェクトは空', () => {
      const errors = validateExpenseForm(validData);
      expect(Object.keys(errors)).toHaveLength(0);
    });
  });
});
