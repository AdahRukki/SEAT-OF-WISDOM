const ONES = [
  "", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine",
  "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen",
  "Seventeen", "Eighteen", "Nineteen",
];

const TENS = [
  "", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety",
];

function intToWords(num: number): string {
  if (num === 0) return "";
  if (num < 20) return ONES[num];
  if (num < 100) {
    const tens = Math.floor(num / 10);
    const ones = num % 10;
    return TENS[tens] + (ones ? " " + ONES[ones] : "");
  }
  if (num < 1000) {
    const hundreds = Math.floor(num / 100);
    const rest = num % 100;
    return ONES[hundreds] + " Hundred" + (rest ? " " + intToWords(rest) : "");
  }
  if (num < 1_000_000) {
    const thousands = Math.floor(num / 1000);
    const rest = num % 1000;
    return intToWords(thousands) + " Thousand" + (rest ? " " + intToWords(rest) : "");
  }
  if (num < 1_000_000_000) {
    const millions = Math.floor(num / 1_000_000);
    const rest = num % 1_000_000;
    return intToWords(millions) + " Million" + (rest ? " " + intToWords(rest) : "");
  }
  return num.toString();
}

export function numberToNairaWords(amount: number | string): string {
  const value = typeof amount === "string" ? parseFloat(amount) : amount;

  if (!isFinite(value) || isNaN(value)) {
    return "Zero Naira Only";
  }

  if (value < 0) {
    return "Negative " + numberToNairaWords(-value);
  }

  if (value === 0) {
    return "Zero Naira Only";
  }

  let naira = Math.floor(value);
  let kobo = Math.round((value - naira) * 100);
  if (kobo === 100) {
    naira += 1;
    kobo = 0;
  }

  const nairaWords = naira === 0 ? "Zero" : intToWords(naira);
  let result = `${nairaWords} Naira`;

  if (kobo > 0) {
    result += ` and ${intToWords(kobo)} Kobo`;
  }

  return result + " Only";
}
