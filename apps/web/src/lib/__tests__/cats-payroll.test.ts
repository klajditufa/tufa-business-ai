import { describe, expect, it } from "vitest";
import { detectKind, findPeriodInGrid, mergeTables, parseCsv, parseDate, parseLines, parseNum, parsePeriod, parseSummary, type Grid } from "../cats-payroll";

// Struktura e tabelave siç shfaqen në e-Filing (Listëpagesa të Dorëzuara / Shfaq Detajet), me vlera prove
const SUMMARY: Grid = [
  ["Formularë ESIG025 të Dorëzuar"],
  ["", "Periudha", "Data e Dorëzimit", "Data e Pritshme e Deklaratës", "Nr. i Punëmarrësve", "Pagat", "Kontributet e Sigurimeve Shoqërore", "Kontributet e Sigurimeve Shëndetësore", "Totali i Tatimit mbi të Ardhurat nga Punësimi", "Model", "Statusi", "Statusi i Dërgimit në ISSH", "Data e Dërgimit në ISSH"],
  ["Shfaq Detajet", "2026 Shtator", "01.10.2026", "20.10.2026", "1", "0", "11,500", "3,400", "0", "Normal", "Deklaratat e regjistruara.", "E dërguar", "07.10.2026"],
  ["Shfaq Detajet", "2025 Dhjetor", "05.01.2026", "20.01.2026", "1", "0", "40,575", "11,996", "0", "Normal", "Deklaratat e regjistruara.", "E dërguar", "14.01.2026"],
  ["Shfaq Detajet", "2026 Gusht", "01.09.2026", "20.10.2026", "3", "1,250,000", "250,800", "42,500", "61,300", "Ndryshim nga Tatimpaguesi", "Aprovuar dhe paguar", "", ""],
];

const DETAIL: Grid = [
  ["Numri i Identifikimit të Tatimpaguesit", "X99999999X", "Emri i biznesit të tatimpaguesit", "TEST SHPK"],
  ["Periudha e Deklarimit", "2026 Shtator", "Periudha e Dorëzimit", "01.10.2026"],
  ["", "[9]", "[10]", "[11]", "[12]", "[13]", "[14]", "[15]", "[16]", "[17]", "[18]", "[19]", "[20]", "[21]", "[22]", "[23]", "[24]", "[25]", "[26]", "[27]", "[28]", "[29]", "[30]", ""],
  ["Shfaq Detajet", "J01020086I", "Test Tufa", "2411.02, Kontabilist", "3/011(8), I vetëpunësuar", "0", "22", "0", "50,000", "11,500", "0", "11,500", "0", "0", "0", "11,500", "100,000", "3,400", "0", "0", "0", "0", "", ""],
  ["Shfaq Detajet", "K12345678B", "Ana Test", "4110.01, Sekretare", "1", "0", "30", "100,000", "100,000", "15,000", "9,500", "24,500", "0", "0", "0", "24,500", "100,000", "3,400", "0", "0", "100,000", "9,100", "Po", ""],
];

describe("parsimet bazë", () => {
  it("periudhat", () => {
    expect(parsePeriod("2026 Shtator")).toEqual({ year: 2026, month: 9 });
    expect(parsePeriod("Nëntor 2025")).toEqual({ year: 2025, month: 11 });
    expect(parsePeriod("09/2026")).toEqual({ year: 2026, month: 9 });
    expect(parsePeriod("Shfaq Detajet")).toBeNull();
  });
  it("numrat", () => {
    expect(parseNum("11,500")).toBe(11500);
    expect(parseNum("1,250,000")).toBe(1250000);
    expect(parseNum("11.500,50")).toBe(11500.5);
    expect(parseNum("1.500.000")).toBe(1500000);
    expect(parseNum("3,4")).toBe(3.4);
    expect(parseNum("12.5")).toBe(12.5);
    expect(parseNum("")).toBe(0);
  });
  it("datat", () => {
    expect(parseDate("01.10.2026")).toBe("2026-10-01");
    expect(parseDate("2026-10-01")).toBe("2026-10-01");
    expect(parseDate("")).toBeNull();
  });
});

describe("Listëpagesa të Dorëzuara", () => {
  it("njihet si përmbledhje dhe lexohen të 3 muajt", () => {
    expect(detectKind(SUMMARY)).toBe("summary");
    const rows = parseSummary(SUMMARY);
    expect(rows).toHaveLength(3);
    expect(rows[0]).toEqual({
      year: 2026, month: 9, model: "Normal", submitted_on: "2026-10-01", due_date: "2026-10-20", employees: 1, gross: 0,
      social: 11500, health: 3400, income_tax: 0, cats_status: "Deklaratat e regjistruara.", issh_status: "E dërguar", issh_sent_on: "2026-10-07",
    });
    expect(rows[1]).toMatchObject({ year: 2025, month: 12, social: 40575, health: 11996 });
    expect(rows[2]).toMatchObject({ month: 8, employees: 3, gross: 1250000, income_tax: 61300, model: "Ndryshim nga Tatimpaguesi", cats_status: "Aprovuar dhe paguar", issh_sent_on: null });
  });
});

describe("Detajet E-SIG 025", () => {
  it("njihen si rreshta punonjësish me fushat [9]–[30]", () => {
    expect(detectKind(DETAIL)).toBe("lines");
    expect(findPeriodInGrid(DETAIL)).toEqual({ year: 2026, month: 9 });
    const lines = parseLines(DETAIL);
    expect(lines).toHaveLength(2);
    expect(lines[0]).toMatchObject({
      nid: "J01020086I", full_name: "Test Tufa", profession: "2411.02, Kontabilist", days_worked: 22, gross: 0,
      social_base: 50000, social_employer: 11500, social_total: 11500, social_all: 11500, health_base: 100000, health_total: 3400, income_tax: 0,
    });
    expect(lines[1]).toMatchObject({ nid: "K12345678B", gross: 100000, social_employer: 15000, social_employee: 9500, tax_base: 100000, income_tax: 9100, personal_status: "Po" });
  });

  it("pa kolonën 'Shfaq Detajet' (eksport Excel) — kolonat zhvendosen saktë", () => {
    const noAction = DETAIL.map((r) => (r[0] === "Shfaq Detajet" || r[0] === "" ? r.slice(1) : r));
    const lines = parseLines(noAction);
    expect(lines.map((l) => [l.nid, l.gross, l.income_tax])).toEqual([["J01020086I", 0, 0], ["K12345678B", 100000, 9100]]);
  });

  it("kokë me emërtimet e plota në vend të numrave", () => {
    const named: Grid = [
      ["Numri Personal", "Emri i Plotë", "Detyra, Funksioni, Profesioni", "Numri i kategorisë së punëmarrësit", "Ditë kalendarike pa punuar", "Ditë kalendarike të punuara",
       "Paga Totale bruto në lekë", "Paga Bruto mbi të cilën llogariten kontributet e sigurimeve shoqërore", "Kontribute për sigurimet shoqërore të detyrueshme të punëdhënësit",
       "Kontribute për sigurimet shoqërore të detyrueshme të punëmarrësit", "Total contributions for compulsory social insurances", "Kontributet Suplementare të punëdhënësit",
       "Kontributet Suplementare të punëmarrësit", "Totali i Kontributeve Suplementare", "Total of Contributions for social insurances",
       "Paga bruto mbi të cilën llogariten kontributet e sigurimeve shëndetësore", "Kontribute për sigurimet shëndetësore gjithsej", "pensionit vullnetar",
       "Zbritja tatimore", "Baza tatimore mbi të cilën llogaritet TAP", "Tatimi mbi të ardhurat nga punësimi (TAP) gjithsej në lekë"],
      ["K12345678B", "Ana Test", "Sekretare", "1", "0", "30", "100000", "100000", "15000", "9500", "24500", "0", "0", "0", "24500", "100000", "3400", "0", "0", "100000", "9100"],
    ];
    expect(detectKind(named)).toBe("lines");
    expect(parseLines(named)[0]).toMatchObject({ nid: "K12345678B", gross: 100000, social_base: 100000, health_base: 100000, health_total: 3400, income_tax: 9100, tax_base: 100000 });
  });
});

describe("struktura reale e tabelës në e-Filing (22.10.2026)", () => {
  const REAL: Grid = [
    ["", "", "Periudha", "Data e Dorëzimit", "Data e Pritshme e Deklaratës", "Nr. i Punëmarrësve", "Pagat", "Kontributet e Sigurimeve Shoqërore", "Kontributet e Sigurimeve Shëndetësore", "Totali i Tatimit mbi të Ardhurat nga Punësimi", "Model", "Statusi", "Statusi i Dërgimit në ISSH", "Data e Dërgimit në ISSH"],
    ["", "Shfaq Detajet", "2026 Shtator", "01.10.2026", "20.10.2026", "1", "0", "11,500", "3,400", "0", "Normal", "Deklaratat e regjistruara.", "E dërguar", "07.10.2026"],
    ["", "Shfaq Detajet", "2025 Dhjetor", "05.01.2026", "20.01.2026", "1", "0", "40,575", "11,996", "0", "Normal", "Deklaratat e regjistruara.", "E dërguar", "14.01.2026"],
  ];
  it("lexohet saktë me dy kolonat bosh në fillim", () => {
    expect(detectKind(REAL)).toBe("summary");
    expect(parseSummary(REAL).map((r) => [r.year, r.month, r.social, r.health, r.due_date, r.issh_sent_on])).toEqual([
      [2026, 9, 11500, 3400, "2026-10-20", "2026-10-07"],
      [2025, 12, 40575, 11996, "2026-01-20", "2026-01-14"],
    ]);
  });
});

describe("CSV i eksportuar nga cis-client-2 (kapja e faqes në e-Filing)", () => {
  // portalTableCsv: rreshti "Kolona n", pastaj të gjitha rreshtat e tabelës së portalit; presje si ndarës
  const CSV =
    "﻿Kolona 1,Kolona 2,Kolona 3,Kolona 4,Kolona 5,Kolona 6,Kolona 7,Kolona 8,Kolona 9,Kolona 10,Kolona 11,Kolona 12,Kolona 13,Kolona 14\r\n" +
    ",,Periudha,Data e Dorëzimit,Data e Pritshme e Deklaratës,Nr. i Punëmarrësve,Pagat,Kontributet e Sigurimeve Shoqërore,Kontributet e Sigurimeve Shëndetësore,Totali i Tatimit mbi të Ardhurat nga Punësimi,Model,Statusi,Statusi i Dërgimit në ISSH,Data e Dërgimit në ISSH\r\n" +
    ',Shfaq Detajet,2026 Shtator,01.10.2026,20.10.2026,1,0,"11,500","3,400",0,Normal,Deklaratat e regjistruara.,E dërguar,07.10.2026\r\n' +
    ',Shfaq Detajet,2026 Gusht,01.09.2026,20.10.2026,3,"1,250,000","250,800","42,500","61,300",Normal,"Aprovuar, por e papaguar",,\r\n';

  it("lexohet me thonjëza dhe presje brenda shumave", () => {
    const grid = parseCsv(CSV);
    expect(grid[2][7]).toBe("11,500");
    expect(detectKind(grid)).toBe("summary");
    expect(parseSummary(grid).map((r) => [r.month, r.employees, r.gross, r.social, r.health, r.income_tax, r.cats_status])).toEqual([
      [9, 1, 0, 11500, 3400, 0, "Deklaratat e regjistruara."],
      [8, 3, 1250000, 250800, 42500, 61300, "Aprovuar, por e papaguar"],
    ]);
  });

  it("CSV me pikëpresje (Excel shqip) dhe apostrof mbrojtës", () => {
    const grid = parseCsv("Periudha;Pagat;Kontributet e Sigurimeve Shoqërore;Kontributet e Sigurimeve Shëndetësore;Totali i Tatimit\n2026 Tetor;'-500;100;34;0\n");
    expect(parseSummary(grid)[0]).toMatchObject({ year: 2026, month: 10, gross: -500, social: 100, health: 34 });
  });
});

describe("faqja e kapur nga cis-client-2 (tables: string[][][])", () => {
  it("detajet: periudha në një tabelë, punonjësit në një tjetër", () => {
    const tables: Grid[] = [DETAIL.slice(0, 2), [["Opsionet e filtrimit"]], DETAIL.slice(2)];
    const grid = mergeTables(tables);
    expect(detectKind(grid)).toBe("lines");
    expect(findPeriodInGrid(grid)).toEqual({ year: 2026, month: 9 });
    expect(parseLines(grid).map((l) => l.nid)).toEqual(["J01020086I", "K12345678B"]);
  });
});
