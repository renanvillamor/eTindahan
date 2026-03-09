export type Delivery = {
  id: number;
  transactionDate: string | null;
  supplierId: number | null;
  supplierName: string | null;
  itemId: number | null;
  itemName: string | null;
  quantity: number;
  uomId: number | null;
  uom: string | null;
  price: number;
  total: number;
};
