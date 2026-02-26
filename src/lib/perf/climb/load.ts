import takeoffRaw from "../../../data/climb/takeoff.json";
import cruiseRaw from "../../../data/climb/cruise.json";
import fuelRaw from "../../../data/climb/fuel.json";
import type {
  CruiseRocJson,
  FuelJson,
  FuelTableRow,
  RocGridRow,
  TakeoffRocJson,
} from "./types";

type RocOrFuelRow = RocGridRow | FuelTableRow;

function normalizePressAlt<T extends RocOrFuelRow>(row: T): T {
  const rawAlt = (row as RocOrFuelRow & { press_alt_ft: number | "SL" }).press_alt_ft;
  const alt = typeof rawAlt === "string" ? 0 : rawAlt;
  return {
    ...row,
    press_alt_ft: alt,
  };
}

function normalizeRocGridRows<T extends { data: RocGridRow[] }>(table: T): T {
  return {
    ...table,
    data: table.data.map((row) => normalizePressAlt(row) as RocGridRow),
  };
}

function normalizeFuelRows<T extends { data: FuelTableRow[] }>(table: T): T {
  return {
    ...table,
    data: table.data.map((row) => normalizePressAlt(row) as FuelTableRow),
  };
}

export const takeoffData: TakeoffRocJson = {
  ...(takeoffRaw as TakeoffRocJson),
  tables: (takeoffRaw as TakeoffRocJson).tables.map((t) => normalizeRocGridRows(t)),
};

export const cruiseData: CruiseRocJson = {
  ...(cruiseRaw as CruiseRocJson),
  tables: (cruiseRaw as CruiseRocJson).tables.map((t) => normalizeRocGridRows(t)),
};

export const fuelData: FuelJson = {
  ...(fuelRaw as FuelJson),
  tables: (fuelRaw as FuelJson).tables.map((t) => normalizeFuelRows(t)),
};

