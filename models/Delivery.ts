export type DeliveryPayment = {
  id: number;
  paymentModeId: number | null;
  paymentModeName: string | null;
  amount: number;
  sourceDate: string | null;
  sourceTypeId: number | null;
  sourceTypeDescription: string | null;
  remarks: string | null;
};

export type Delivery = {
  id: number; // delivery_item id
  deliveryId: number; // delivery (batch) id
  transactionDate: string | null;
  supplierId: number | null;
  supplierName: string | null;
  isPaid: boolean;
  itemId: number | null;
  itemName: string | null;
  quantity: number;
  uomId: number | null;
  uom: string | null;
  price: number;
  total: number; // quantity * price
  payments: DeliveryPayment[]; // batch-level payment breakdown
};
