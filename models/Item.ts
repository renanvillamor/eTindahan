export type Item = {
  id: number;
  name: string;
  description: string | null;
  type: string | null;
  typeId: number | null;
  isActive: boolean;
  supplierPrice: number;
  wholesalePrice: number;
  retailPrice: number;
  packUom: string;
  packUomId: number;
  packSize: number | null;
  singleUom: string;
  singleUomId: number;
};
