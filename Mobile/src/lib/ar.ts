/** Arabic counted-noun forms: 1 جملة · 2 جملتان · 3–10 جمل · 11+ جملة. */
type Forms = { one: string; two: string; few: string; many: string };

export const NOUN = {
  phrase: { one: 'جملة واحدة', two: 'جملتان', few: 'جمل', many: 'جملة' },
  point: { one: 'نقطة واحدة', two: 'نقطتان', few: 'نقاط', many: 'نقطة' },
  day: { one: 'يوم واحد', two: 'يومان', few: 'أيام', many: 'يومًا' },
  recording: { one: 'تسجيل واحد', two: 'تسجيلان', few: 'تسجيلات', many: 'تسجيلًا' },
} satisfies Record<string, Forms>;

export function count(n: number, noun: Forms): string {
  if (n === 0) return `0 ${noun.many}`;
  if (n === 1) return noun.one;
  if (n === 2) return noun.two;
  const tail = n % 100;
  return `${n} ${tail >= 3 && tail <= 10 ? noun.few : noun.many}`;
}
