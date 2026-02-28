import { describe, expect, it } from "vitest";
import { lookupGridRoc } from "./lookups";

/**
 * Doğrulama: 2979 ft, 2042 kg, -1°C için ROC datayla uyumlu mu?
 * cruise.json (Vclimb): 1999 kg @ 2000 ft →1250/1250; @ 4000 ft →1230/1230 → bilinear ~1240 fpm
 * takeoff.json (Vy UP): benzer ~1202 fpm. Beklenen aralık: 1150–1250 fpm.
 */
const PA = 2979;
const WEIGHT_KG = 2042;
const OAT_C = -1;

describe("lookupGridRoc", () => {
  it("Vclimb (cruise): 2979 ft, 2042 kg, -1°C gives ROC in 1150–1250 fpm", () => {
    const r = lookupGridRoc("cruise", undefined, WEIGHT_KG, PA, OAT_C);
    expect(r.unsupported).toBe(false);
    expect(r.rocFpm).not.toBeNull();
    expect((r.rocFpm as number) >= 1150 && (r.rocFpm as number) <= 1250).toBe(true);
  });

  it("Vy (takeoff UP): 2979 ft, 2042 kg, -1°C gives ROC in 1150–1250 fpm", () => {
    const r = lookupGridRoc("takeoff", "UP", WEIGHT_KG, PA, OAT_C);
    expect(r.unsupported).toBe(false);
    expect(r.rocFpm).not.toBeNull();
    expect((r.rocFpm as number) >= 1150 && (r.rocFpm as number) <= 1250).toBe(true);
  });
});
