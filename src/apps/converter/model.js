// @ts-check
// Unit Converter model: 16 categories with SI vs IEC data sizes, temperature,
// fuel economy, cooking, number bases (bin/oct/dec/hex), and Roman numerals.

/**
 * @typedef {object} UnitDef
 * @property {string} id
 * @property {Record<string, string>} name
 * @property {number} [toBase]           multiplier to convert 1 unit to base unit
 * @property {(val: number) => number} [customToBase]
 * @property {(baseVal: number) => number} [customFromBase]
 */

/**
 * @typedef {object} CategoryDef
 * @property {string} id
 * @property {Record<string, string>} name
 * @property {string} baseUnit
 * @property {UnitDef[]} units
 */

export const CATEGORIES = /** @type {CategoryDef[]} */ ([
  {
    id: 'length',
    name: { en: 'Length', de: 'Länge' },
    baseUnit: 'm',
    units: [
      { id: 'mm', name: { en: 'Millimeter (mm)', de: 'Millimeter (mm)' }, toBase: 0.001 },
      { id: 'cm', name: { en: 'Centimeter (cm)', de: 'Zentimeter (cm)' }, toBase: 0.01 },
      { id: 'm', name: { en: 'Meter (m)', de: 'Meter (m)' }, toBase: 1 },
      { id: 'km', name: { en: 'Kilometer (km)', de: 'Kilometer (km)' }, toBase: 1000 },
      { id: 'in', name: { en: 'Inch (in)', de: 'Zoll (in)' }, toBase: 0.0254 },
      { id: 'ft', name: { en: 'Foot (ft)', de: 'Fuß (ft)' }, toBase: 0.3048 },
      { id: 'yd', name: { en: 'Yard (yd)', de: 'Yard (yd)' }, toBase: 0.9144 },
      { id: 'mi', name: { en: 'Mile (mi)', de: 'Meile (mi)' }, toBase: 1609.344 },
      { id: 'nmi', name: { en: 'Nautical Mile', de: 'Seemeile' }, toBase: 1852 },
    ],
  },
  {
    id: 'datasize',
    name: { en: 'Data Size (SI vs IEC)', de: 'Datengröße (SI / IEC)' },
    baseUnit: 'B',
    units: [
      { id: 'B', name: { en: 'Bytes (B)', de: 'Byte (B)' }, toBase: 1 },
      { id: 'kB', name: { en: 'Kilobytes SI (kB = 1000 B)', de: 'Kilobyte SI (kB = 1000 B)' }, toBase: 1000 },
      { id: 'KiB', name: { en: 'Kibibytes IEC (KiB = 1024 B)', de: 'Kibibyte IEC (KiB = 1024 B)' }, toBase: 1024 },
      { id: 'MB', name: { en: 'Megabytes SI (MB = 1e6 B)', de: 'Megabyte SI (MB = 1e6 B)' }, toBase: 1e6 },
      {
        id: 'MiB',
        name: { en: 'Mebibytes IEC (MiB = 1024² B)', de: 'Mebibyte IEC (MiB = 1024² B)' },
        toBase: 1024 ** 2,
      },
      { id: 'GB', name: { en: 'Gigabytes SI (GB = 1e9 B)', de: 'Gigabyte SI (GB = 1e9 B)' }, toBase: 1e9 },
      {
        id: 'GiB',
        name: { en: 'Gibibytes IEC (GiB = 1024³ B)', de: 'Gibibyte IEC (GiB = 1024³ B)' },
        toBase: 1024 ** 3,
      },
      { id: 'TB', name: { en: 'Terabytes SI (TB = 1e12 B)', de: 'Terabyte SI (TB = 1e12 B)' }, toBase: 1e12 },
      {
        id: 'TiB',
        name: { en: 'Tebibytes IEC (TiB = 1024⁴ B)', de: 'Tebibyte IEC (TiB = 1024⁴ B)' },
        toBase: 1024 ** 4,
      },
      { id: 'PB', name: { en: 'Petabytes SI (PB = 1e15 B)', de: 'Petabyte SI (PB = 1e15 B)' }, toBase: 1e15 },
      {
        id: 'PiB',
        name: { en: 'Pebibytes IEC (PiB = 1024⁵ B)', de: 'Pebibyte IEC (PiB = 1024⁵ B)' },
        toBase: 1024 ** 5,
      },
    ],
  },
  {
    id: 'temperature',
    name: { en: 'Temperature', de: 'Temperatur' },
    baseUnit: 'C',
    units: [
      { id: 'C', name: { en: 'Celsius (°C)', de: 'Celsius (°C)' }, customToBase: (v) => v, customFromBase: (v) => v },
      {
        id: 'F',
        name: { en: 'Fahrenheit (°F)', de: 'Fahrenheit (°F)' },
        customToBase: (v) => (v - 32) * (5 / 9),
        customFromBase: (v) => v * (9 / 5) + 32,
      },
      {
        id: 'K',
        name: { en: 'Kelvin (K)', de: 'Kelvin (K)' },
        customToBase: (v) => v - 273.15,
        customFromBase: (v) => v + 273.15,
      },
    ],
  },
  {
    id: 'mass',
    name: { en: 'Mass / Weight', de: 'Masse / Gewicht' },
    baseUnit: 'g',
    units: [
      { id: 'mg', name: { en: 'Milligram (mg)', de: 'Milligramm (mg)' }, toBase: 0.001 },
      { id: 'g', name: { en: 'Gram (g)', de: 'Gramm (g)' }, toBase: 1 },
      { id: 'kg', name: { en: 'Kilogram (kg)', de: 'Kilogramm (kg)' }, toBase: 1000 },
      { id: 't', name: { en: 'Metric Ton (t)', de: 'Tonne (t)' }, toBase: 1e6 },
      { id: 'oz', name: { en: 'Ounce (oz)', de: 'Unze (oz)' }, toBase: 28.34952 },
      { id: 'lb', name: { en: 'Pound (lb)', de: 'Pfund (lb)' }, toBase: 453.59237 },
      { id: 'st', name: { en: 'Stone (st)', de: 'Stone (st)' }, toBase: 6350.293 },
    ],
  },
  {
    id: 'speed',
    name: { en: 'Speed', de: 'Geschwindigkeit' },
    baseUnit: 'm/s',
    units: [
      { id: 'm/s', name: { en: 'Meters per second (m/s)', de: 'Meter pro Sekunde (m/s)' }, toBase: 1 },
      { id: 'km/h', name: { en: 'Kilometers per hour (km/h)', de: 'Kilometer pro Stunde (km/h)' }, toBase: 1 / 3.6 },
      { id: 'mph', name: { en: 'Miles per hour (mph)', de: 'Meilen pro Stunde (mph)' }, toBase: 0.44704 },
      { id: 'knot', name: { en: 'Knot (kn)', de: 'Knoten (kn)' }, toBase: 0.514444 },
    ],
  },
  {
    id: 'area',
    name: { en: 'Area', de: 'Fläche' },
    baseUnit: 'm2',
    units: [
      { id: 'm2', name: { en: 'Square meter (m²)', de: 'Quadratmeter (m²)' }, toBase: 1 },
      { id: 'km2', name: { en: 'Square kilometer (km²)', de: 'Quadratkilometer (km²)' }, toBase: 1e6 },
      { id: 'ha', name: { en: 'Hectare (ha)', de: 'Hektar (ha)' }, toBase: 10000 },
      { id: 'acre', name: { en: 'Acre', de: 'Acre' }, toBase: 4046.8564224 },
      { id: 'sqft', name: { en: 'Square foot (sq ft)', de: 'Quadratfuß (sq ft)' }, toBase: 0.09290304 },
    ],
  },
  {
    id: 'volume',
    name: { en: 'Volume', de: 'Volumen' },
    baseUnit: 'l',
    units: [
      { id: 'ml', name: { en: 'Milliliter (ml)', de: 'Milliliter (ml)' }, toBase: 0.001 },
      { id: 'l', name: { en: 'Liter (l)', de: 'Liter (l)' }, toBase: 1 },
      { id: 'm3', name: { en: 'Cubic meter (m³)', de: 'Kubikmeter (m³)' }, toBase: 1000 },
      { id: 'gal_us', name: { en: 'Gallon (US)', de: 'Gallone (US)' }, toBase: 3.78541 },
      { id: 'floz_us', name: { en: 'Fluid Ounce (US)', de: 'Flüssigunze (US)' }, toBase: 0.0295735 },
    ],
  },
  {
    id: 'time',
    name: { en: 'Time', de: 'Zeit' },
    baseUnit: 's',
    units: [
      { id: 'ms', name: { en: 'Millisecond (ms)', de: 'Millisekunde (ms)' }, toBase: 0.001 },
      { id: 's', name: { en: 'Second (s)', de: 'Sekunde (s)' }, toBase: 1 },
      { id: 'min', name: { en: 'Minute (min)', de: 'Minute (min)' }, toBase: 60 },
      { id: 'h', name: { en: 'Hour (h)', de: 'Stunde (h)' }, toBase: 3600 },
      { id: 'd', name: { en: 'Day (d)', de: 'Tag (d)' }, toBase: 86400 },
      { id: 'wk', name: { en: 'Week', de: 'Woche' }, toBase: 604800 },
      { id: 'yr', name: { en: 'Year (365d)', de: 'Jahr (365d)' }, toBase: 31536000 },
    ],
  },
  {
    id: 'pressure',
    name: { en: 'Pressure', de: 'Druck' },
    baseUnit: 'pa',
    units: [
      { id: 'pa', name: { en: 'Pascal (Pa)', de: 'Pascal (Pa)' }, toBase: 1 },
      { id: 'kpa', name: { en: 'Kilopascal (kPa)', de: 'Kilopascal (kPa)' }, toBase: 1000 },
      { id: 'bar', name: { en: 'Bar', de: 'Bar' }, toBase: 100000 },
      { id: 'psi', name: { en: 'Pound per sq inch (psi)', de: 'Psi (psi)' }, toBase: 6894.757 },
      { id: 'atm', name: { en: 'Atmosphere (atm)', de: 'Atmosphäre (atm)' }, toBase: 101325 },
    ],
  },
  {
    id: 'energy',
    name: { en: 'Energy', de: 'Energie' },
    baseUnit: 'j',
    units: [
      { id: 'j', name: { en: 'Joule (J)', de: 'Joule (J)' }, toBase: 1 },
      { id: 'kj', name: { en: 'Kilojoule (kJ)', de: 'Kilojoule (kJ)' }, toBase: 1000 },
      { id: 'cal', name: { en: 'Calorie (cal)', de: 'Kalorie (cal)' }, toBase: 4.184 },
      { id: 'kcal', name: { en: 'Kilocalorie (kcal)', de: 'Kilokalorie (kcal)' }, toBase: 4184 },
      { id: 'wh', name: { en: 'Watt-hour (Wh)', de: 'Wattstunde (Wh)' }, toBase: 3600 },
      { id: 'kwh', name: { en: 'Kilowatt-hour (kWh)', de: 'Kilowattstunde (kWh)' }, toBase: 3.6e6 },
    ],
  },
  {
    id: 'power',
    name: { en: 'Power', de: 'Leistung' },
    baseUnit: 'w',
    units: [
      { id: 'w', name: { en: 'Watt (W)', de: 'Watt (W)' }, toBase: 1 },
      { id: 'kw', name: { en: 'Kilowatt (kW)', de: 'Kilowatt (kW)' }, toBase: 1000 },
      { id: 'mw', name: { en: 'Megawatt (MW)', de: 'Megawatt (MW)' }, toBase: 1e6 },
      { id: 'hp', name: { en: 'Horsepower (metric PS)', de: 'Pferdestärke (PS)' }, toBase: 735.49875 },
    ],
  },
  {
    id: 'angle',
    name: { en: 'Angle', de: 'Winkel' },
    baseUnit: 'deg',
    units: [
      { id: 'deg', name: { en: 'Degree (°)', de: 'Grad (°)' }, toBase: 1 },
      { id: 'rad', name: { en: 'Radian (rad)', de: 'Radiant (rad)' }, toBase: 180 / Math.PI },
      { id: 'grad', name: { en: 'Gradian (gon)', de: 'Neugrad (gon)' }, toBase: 0.9 },
    ],
  },
  {
    id: 'datarate',
    name: { en: 'Data Rate', de: 'Datenrate' },
    baseUnit: 'bps',
    units: [
      { id: 'bps', name: { en: 'Bits/s (bps)', de: 'Bit/s (bps)' }, toBase: 1 },
      { id: 'kbps', name: { en: 'Kilobits/s (kbps)', de: 'Kilobit/s (kbps)' }, toBase: 1e3 },
      { id: 'mbps', name: { en: 'Megabits/s (Mbps)', de: 'Megabit/s (Mbps)' }, toBase: 1e6 },
      { id: 'gbps', name: { en: 'Gigabits/s (Gbps)', de: 'Gigabit/s (Gbps)' }, toBase: 1e9 },
      { id: 'kbs', name: { en: 'Kilobytes/s (kB/s)', de: 'Kilobyte/s (kB/s)' }, toBase: 8e3 },
      { id: 'mbs', name: { en: 'Megabytes/s (MB/s)', de: 'Megabyte/s (MB/s)' }, toBase: 8e6 },
    ],
  },
  {
    id: 'frequency',
    name: { en: 'Frequency', de: 'Frequenz' },
    baseUnit: 'hz',
    units: [
      { id: 'hz', name: { en: 'Hertz (Hz)', de: 'Hertz (Hz)' }, toBase: 1 },
      { id: 'khz', name: { en: 'Kilohertz (kHz)', de: 'Kilohertz (kHz)' }, toBase: 1e3 },
      { id: 'mhz', name: { en: 'Megahertz (MHz)', de: 'Megahertz (MHz)' }, toBase: 1e6 },
      { id: 'ghz', name: { en: 'Gigahertz (GHz)', de: 'Gigahertz (GHz)' }, toBase: 1e9 },
      { id: 'rpm', name: { en: 'RPM (rev/min)', de: 'Umdrehungen/min (U/min)' }, toBase: 1 / 60 },
    ],
  },
  {
    id: 'fueleconomy',
    name: { en: 'Fuel Economy', de: 'Kraftstoffverbrauch' },
    baseUnit: 'l100km',
    units: [
      {
        id: 'l100km',
        name: { en: 'Liters / 100 km (l/100km)', de: 'Liter / 100 km (l/100km)' },
        customToBase: (v) => v,
        customFromBase: (v) => v,
      },
      {
        id: 'mpg_us',
        name: { en: 'Miles per Gallon US (mpg)', de: 'Miles per Gallon US (mpg)' },
        customToBase: (v) => (v === 0 ? 0 : 235.215 / v),
        customFromBase: (v) => (v === 0 ? 0 : 235.215 / v),
      },
      {
        id: 'kml',
        name: { en: 'Kilometers per Liter (km/l)', de: 'Kilometer pro Liter (km/l)' },
        customToBase: (v) => (v === 0 ? 0 : 100 / v),
        customFromBase: (v) => (v === 0 ? 0 : 100 / v),
      },
    ],
  },
  {
    id: 'cooking',
    name: { en: 'Cooking Units', de: 'Kocheinheiten' },
    baseUnit: 'ml',
    units: [
      { id: 'ml', name: { en: 'Milliliter (ml)', de: 'Milliliter (ml)' }, toBase: 1 },
      { id: 'tsp', name: { en: 'Teaspoon / Teelöffel (5 ml)', de: 'Teelöffel / TL (5 ml)' }, toBase: 5 },
      { id: 'tbsp', name: { en: 'Tablespoon / Esslöffel (15 ml)', de: 'Esslöffel / EL (15 ml)' }, toBase: 15 },
      { id: 'cup', name: { en: 'Cup (US 240 ml)', de: 'Tasse / Cup (240 ml)' }, toBase: 240 },
      { id: 'pinch', name: { en: 'Pinch (Prise ~0.5 ml)', de: 'Prise (~0,5 ml)' }, toBase: 0.5 },
    ],
  },
]);

/**
 * Converts value from one unit to another within a category.
 * @param {number} val
 * @param {string} fromUnitId
 * @param {string} toUnitId
 * @param {string} categoryId
 * @returns {number}
 */
export function convertUnit(val, fromUnitId, toUnitId, categoryId) {
  if (fromUnitId === toUnitId) return val;

  const cat = CATEGORIES.find((c) => c.id === categoryId);
  if (!cat) return val;

  const fromDef = cat.units.find((u) => u.id === fromUnitId);
  const toDef = cat.units.find((u) => u.id === toUnitId);
  if (!fromDef || !toDef) return val;

  // Convert to base
  let baseVal = 0;
  if (fromDef.customToBase) {
    baseVal = fromDef.customToBase(val);
  } else if (fromDef.toBase !== undefined) {
    baseVal = val * fromDef.toBase;
  }

  // Convert from base
  let result = 0;
  if (toDef.customFromBase) {
    result = toDef.customFromBase(baseVal);
  } else if (toDef.toBase !== undefined) {
    result = baseVal / toDef.toBase;
  }

  return Number(result.toFixed(8));
}

/**
 * Converts integer to Roman numeral string.
 * @param {number} num (1 to 3999)
 * @returns {string}
 */
export function arabicToRoman(num) {
  if (num <= 0 || num > 3999 || !Number.isInteger(num)) return '';
  const romanMap = [
    { v: 1000, s: 'M' },
    { v: 900, s: 'CM' },
    { v: 500, s: 'D' },
    { v: 400, s: 'CD' },
    { v: 100, s: 'C' },
    { v: 90, s: 'XC' },
    { v: 50, s: 'L' },
    { v: 40, s: 'XL' },
    { v: 10, s: 'X' },
    { v: 9, s: 'IX' },
    { v: 5, s: 'V' },
    { v: 4, s: 'IV' },
    { v: 1, s: 'I' },
  ];
  let res = '';
  let rem = num;
  for (const { v, s } of romanMap) {
    while (rem >= v) {
      res += s;
      rem -= v;
    }
  }
  return res;
}

/**
 * Converts Roman numeral string to Arabic integer.
 * @param {string} roman
 * @returns {number | null}
 */
export function romanToArabic(roman) {
  if (!roman || typeof roman !== 'string') return null;
  const map = /** @type {Record<string, number>} */ ({
    I: 1,
    V: 5,
    X: 10,
    L: 50,
    C: 100,
    D: 500,
    M: 1000,
  });

  const upper = roman.trim().toUpperCase();
  let total = 0;
  for (let i = 0; i < upper.length; i++) {
    const cur = map[upper[i]];
    const next = map[upper[i + 1]];
    if (!cur) return null;
    if (next && next > cur) {
      total += next - cur;
      i++;
    } else {
      total += cur;
    }
  }
  return total;
}

/**
 * Converts number string between bases (2, 8, 10, 16).
 * @param {string} val
 * @param {number} fromBase
 * @param {number} toBase
 * @returns {string}
 */
export function convertBase(val, fromBase, toBase) {
  try {
    const intVal = parseInt(val.trim(), fromBase);
    if (isNaN(intVal)) return '';
    return intVal.toString(toBase).toUpperCase();
  } catch {
    return '';
  }
}
