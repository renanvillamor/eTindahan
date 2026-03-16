import { Delivery } from "@/models/Delivery";
import { Inventory } from "@/models/Inventory";
import { Item } from "@/models/Item";
import { ItemType } from "@/models/ItemType";
import { SaleToday } from "@/models/SaleToday";
import { Supplier } from "@/models/Supplier";
import { Uom } from "@/models/Uom";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { immer } from "zustand/middleware/immer";

type StoreState = {
  items: Item[];
  itemTypes: ItemType[];
  inventories: Inventory[];
  deliveries: Delivery[];
  suppliers: Supplier[];
  uoms: Uom[];
  salesToday: SaleToday[];
  setItems: (items: Item[]) => void;
  setItemTypes: (itemTypes: ItemType[]) => void;
  setInventories: (inventories: Inventory[]) => void;
  setDeliveries: (deliveries: Delivery[]) => void;
  setSuppliers: (suppliers: Supplier[]) => void;
  setUoms: (uoms: Uom[]) => void;
  setSalesToday: (dbSales: SaleToday[]) => void;
  addSalesToday: (sales: SaleToday[]) => void;
  clearUnsyncedSales: () => void;
  updateItem: (item: Item) => void;
  removeItem: (itemId: number) => void;
  updateItemType: (itemType: ItemType) => void;
  removeItemType: (id: number) => void;
  updateSupplier: (supplier: Supplier) => void;
  removeSupplier: (id: number) => void;
  updateUom: (uom: Uom) => void;
  removeUom: (id: number) => void;
};

export const useStore = create<StoreState>()(
  persist(
    immer((set) => ({
      items: [],
      itemTypes: [],
      inventories: [],
      deliveries: [],
      suppliers: [],
      uoms: [],
      salesToday: [],
      setItems: (items) => {
        set((state) => {
          state.items = items;
        });
      },
      setItemTypes: (itemTypes) => {
        set((state) => {
          state.itemTypes = itemTypes;
        });
      },
      setInventories: (inventories) => {
        set((state) => {
          state.inventories = inventories;
        });
      },
      setDeliveries: (deliveries) => {
        set((state) => {
          state.deliveries = deliveries;
        });
      },
      setSuppliers: (suppliers) => {
        set((state) => {
          state.suppliers = suppliers;
        });
      },
      setUoms: (uoms) => {
        set((state) => {
          state.uoms = uoms;
        });
      },
      setSalesToday: (dbSales) => {
        set((state) => {
          const today = new Date().toISOString().slice(0, 10);
          const unsynced = state.salesToday
            .filter(
              (s) => s.synced === false && s.transactionDate.startsWith(today),
            )
            .map((s) => ({ ...s }));
          state.salesToday = [
            ...dbSales.map((s) => ({ ...s, synced: true as boolean })),
            ...unsynced,
          ];
        });
      },
      addSalesToday: (newSales) => {
        set((state) => {
          state.salesToday = [...newSales, ...state.salesToday];
        });
      },
      clearUnsyncedSales: () => {
        set((state) => {
          state.salesToday = state.salesToday.filter((s) => s.synced !== false);
        });
      },
      updateItem: (item) => {
        set((state) => {
          const index = state.items.findIndex((i) => i.id === item.id);
          if (index !== -1) {
            state.items[index] = item;
          } else {
            state.items.push(item);
          }
        });
      },
      removeItem: (itemId) => {
        set((state) => {
          state.items = state.items.filter((i) => i.id !== itemId);
        });
      },
      updateItemType: (itemType) => {
        set((state) => {
          const index = state.itemTypes.findIndex((i) => i.id === itemType.id);
          if (index !== -1) {
            state.itemTypes[index] = itemType;
          } else {
            state.itemTypes.push(itemType);
          }
        });
      },
      removeItemType: (id) => {
        set((state) => {
          state.itemTypes = state.itemTypes.filter((i) => i.id !== id);
        });
      },
      updateSupplier: (supplier) => {
        set((state) => {
          const index = state.suppliers.findIndex((s) => s.id === supplier.id);
          if (index !== -1) {
            state.suppliers[index] = supplier;
          } else {
            state.suppliers.push(supplier);
          }
        });
      },
      removeSupplier: (id) => {
        set((state) => {
          state.suppliers = state.suppliers.filter((s) => s.id !== id);
        });
      },
      updateUom: (uom) => {
        set((state) => {
          const index = state.uoms.findIndex((u) => u.id === uom.id);
          if (index !== -1) {
            state.uoms[index] = uom;
          } else {
            state.uoms.push(uom);
          }
        });
      },
      removeUom: (id) => {
        set((state) => {
          state.uoms = state.uoms.filter((u) => u.id !== id);
        });
      },
    })),
    {
      name: "etindahan-store",
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);
