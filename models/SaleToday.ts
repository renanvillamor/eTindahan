export type SaleToday = {
  id: number;
  transactionDate: string;
  itemId: number;
  name: string;
  typeId: number | null;
  type: string | null;
  quantity: number;
  uomId: number | null;
  uom: string | null;
  price: number;
  total: number;
  createdBy: string | null;
  synced?: boolean;
  pendingDelete?: boolean;
  paymentModeId?: number | null;
  paymentMode?: string | null;
};
