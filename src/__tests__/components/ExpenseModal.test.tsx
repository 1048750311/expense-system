import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import ExpenseModal, { type InitialExpenseData } from '@/components/ExpenseModal';

// ── カテゴリAPIのモック ──────────────────────────────
const mockCategories = [
  { id: 'cat-001', name: '交通費', code: 'TRANSPORT' },
  { id: 'cat-002', name: '宿泊費', code: 'ACCOMMODATION' },
];

beforeEach(() => {
  global.fetch = vi.fn().mockResolvedValue({
    json: () => Promise.resolve({ success: true, data: mockCategories }),
  } as unknown as Response);
});

// ── 共通のデフォルト Props ────────────────────────────
const defaultProps = {
  isOpen: true,
  onClose: vi.fn(),
  onSubmit: vi.fn().mockResolvedValue(undefined),
};

// ── 編集モード用の既存データ ──────────────────────────
const editData: InitialExpenseData = {
  date: '2026-01-15',
  categoryId: 'cat-001',
  category: '交通費',
  transportation: 'train',
  tripType: 'one-way',
  receipt: 'yes',
  amount: 3000,
  description: '新宿〜渋谷 電車代',
};

// =========================================================
// 新規登録モード
// =========================================================
describe('ExpenseModal — 新規登録モード', () => {
  it('ヘッダーに「交通費精算登録」が表示される', async () => {
    render(<ExpenseModal {...defaultProps} />);
    expect(screen.getByText('交通費精算登録')).toBeInTheDocument();
  });

  it('送信ボタンに「登録」が表示される', async () => {
    render(<ExpenseModal {...defaultProps} />);
    expect(screen.getByRole('button', { name: '登録' })).toBeInTheDocument();
  });

  it('ファイルアップロードセクションが表示される', async () => {
    render(<ExpenseModal {...defaultProps} />);
    expect(screen.getByText('添付ファイル（領収書）')).toBeInTheDocument();
  });

  it('isOpen=false のとき何も描画しない', () => {
    render(<ExpenseModal {...defaultProps} isOpen={false} />);
    expect(screen.queryByText('交通費精算登録')).not.toBeInTheDocument();
  });
});

// =========================================================
// 編集モード
// =========================================================
describe('ExpenseModal — 編集モード', () => {
  it('ヘッダーに「交通費精算編集」が表示される', () => {
    render(<ExpenseModal {...defaultProps} initialData={editData} />);
    expect(screen.getByText('交通費精算編集')).toBeInTheDocument();
  });

  it('送信ボタンに「更新」が表示される', () => {
    render(<ExpenseModal {...defaultProps} initialData={editData} />);
    expect(screen.getByRole('button', { name: '更新' })).toBeInTheDocument();
  });

  it('ファイルアップロードセクションが表示されない', () => {
    render(<ExpenseModal {...defaultProps} initialData={editData} />);
    expect(screen.queryByText('添付ファイル（領収書）')).not.toBeInTheDocument();
  });

  it('日付フィールドに既存データが入力済み', () => {
    render(<ExpenseModal {...defaultProps} initialData={editData} />);
    const dateInput = screen.getByLabelText<HTMLInputElement>(/月日/);
    expect(dateInput.value).toBe('2026-01-15');
  });

  it('金額フィールドに既存データが入力済み', () => {
    render(<ExpenseModal {...defaultProps} initialData={editData} />);
    const amountInput = screen.getByLabelText<HTMLInputElement>(/金額/);
    expect(amountInput.value).toBe('3000');
  });

  it('内容フィールドに既存データが入力済み', () => {
    render(<ExpenseModal {...defaultProps} initialData={editData} />);
    expect(screen.getByDisplayValue('新宿〜渋谷 電車代')).toBeInTheDocument();
  });
});

// =========================================================
// バリデーションエラー表示
// =========================================================
describe('ExpenseModal — バリデーション', () => {
  it('空のまま送信するとエラーメッセージが表示される', async () => {
    const user = userEvent.setup();
    render(<ExpenseModal {...defaultProps} />);

    // カテゴリが読み込まれるのを待つ
    await waitFor(() => expect(global.fetch).toHaveBeenCalled());

    // 日付・金額・内容を空にした状態で送信
    const dateInput = screen.getByLabelText<HTMLInputElement>(/月日/);
    await user.clear(dateInput);
    const amountInput = screen.getByLabelText<HTMLInputElement>(/金額/);
    await user.clear(amountInput);

    await user.click(screen.getByRole('button', { name: '登録' }));

    expect(await screen.findByText('日付を入力してください')).toBeInTheDocument();
    expect(await screen.findByText('1円以上の金額を入力してください')).toBeInTheDocument();
    expect(await screen.findByText('内容を入力してください')).toBeInTheDocument();
  });

  it('日付を入力するとそのフィールドのエラーがクリアされる', async () => {
    const user = userEvent.setup();
    render(<ExpenseModal {...defaultProps} />);

    await waitFor(() => expect(global.fetch).toHaveBeenCalled());

    // まず送信してエラーを出す
    const dateInput = screen.getByLabelText<HTMLInputElement>(/月日/);
    await user.clear(dateInput);
    await user.click(screen.getByRole('button', { name: '登録' }));
    expect(await screen.findByText('日付を入力してください')).toBeInTheDocument();

    // 日付を入力するとエラーが消える
    await user.type(dateInput, '2026-03-23');
    await waitFor(() => {
      expect(screen.queryByText('日付を入力してください')).not.toBeInTheDocument();
    });
  });

  it('金額が0のとき「1円以上の金額を入力してください」が表示される', async () => {
    const user = userEvent.setup();
    render(<ExpenseModal {...defaultProps} />);

    await waitFor(() => expect(global.fetch).toHaveBeenCalled());

    const amountInput = screen.getByLabelText<HTMLInputElement>(/金額/);
    await user.clear(amountInput);
    await user.click(screen.getByRole('button', { name: '登録' }));

    expect(await screen.findByText('1円以上の金額を入力してください')).toBeInTheDocument();
  });
});

// =========================================================
// モーダルの開閉
// =========================================================
describe('ExpenseModal — 開閉', () => {
  it('キャンセルボタンをクリックすると onClose が呼ばれる', async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(<ExpenseModal {...defaultProps} onClose={onClose} />);

    await user.click(screen.getByRole('button', { name: 'キャンセル' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('送信中はキャンセルボタンが無効化される', async () => {
    // onSubmit が解決しないPromiseを返す（送信中状態を再現）
    const onSubmit = vi.fn(() => new Promise<void>(() => {}));
    const user = userEvent.setup();
    render(
      <ExpenseModal
        {...defaultProps}
        initialData={editData}
        onSubmit={onSubmit}
      />
    );

    await waitFor(() => expect(global.fetch).toHaveBeenCalled());

    // 更新ボタン押下（バリデーションを通過させるため編集モードのデータを使用）
    await user.click(screen.getByRole('button', { name: '更新' }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'キャンセル' })).toBeDisabled();
    });
  });
});

// =========================================================
// ファイルアップロードバリデーション
// =========================================================
describe('ExpenseModal — ファイルアップロード', () => {
  it('サポート外の形式のファイルを選択するとエラーが表示される', async () => {
    // applyAccept: false で <input accept> によるフィルタリングを無効化
    const user = userEvent.setup({ applyAccept: false });
    render(<ExpenseModal {...defaultProps} />);

    await waitFor(() => expect(global.fetch).toHaveBeenCalled());

    const fileInput = screen.getByLabelText<HTMLInputElement>(/ファイルを選択/);
    const invalidFile = new File(['content'], 'test.gif', { type: 'image/gif' });
    await user.upload(fileInput, invalidFile);

    expect(await screen.findByText('jpg、png、pdf のみアップロードできます')).toBeInTheDocument();
  });

  it('5MBを超えるファイルを選択するとエラーが表示される', async () => {
    const user = userEvent.setup();
    render(<ExpenseModal {...defaultProps} />);

    await waitFor(() => expect(global.fetch).toHaveBeenCalled());

    const fileInput = screen.getByLabelText<HTMLInputElement>(/ファイルを選択/);
    // 6MB のファイル
    const largeContent = new Uint8Array(6 * 1024 * 1024);
    const largeFile = new File([largeContent], 'large.jpg', { type: 'image/jpeg' });
    await user.upload(fileInput, largeFile);

    expect(await screen.findByText(/ファイルサイズは5MB以下にしてください/)).toBeInTheDocument();
  });

  it('有効なJPEGファイルを選択するとファイル名が表示される', async () => {
    const user = userEvent.setup();
    render(<ExpenseModal {...defaultProps} />);

    await waitFor(() => expect(global.fetch).toHaveBeenCalled());

    const fileInput = screen.getByLabelText<HTMLInputElement>(/ファイルを選択/);
    const validFile = new File(['jpeg content'], 'receipt.jpg', { type: 'image/jpeg' });
    await user.upload(fileInput, validFile);

    expect(await screen.findByText('選択済み: receipt.jpg')).toBeInTheDocument();
  });
});
