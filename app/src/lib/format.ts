import { UNIT_LABEL } from './labels';
import type { SizeUnit } from './types';

/** ₹45,00,000 -> "₹45 lakh"; ₹1,25,00,000 -> "₹1.25 crore". */
export function rupees(n: number): string {
  if (!isFinite(n) || n <= 0) return 'Price on request';
  if (n >= 1e7) return '₹' + trim(n / 1e7) + ' crore';
  if (n >= 1e5) return '₹' + trim(n / 1e5) + ' lakh';
  return '₹' + n.toLocaleString('en-IN');
}
function trim(x: number) {
  return x.toFixed(2).replace(/\.?0+$/, '');
}

export function fullRupees(n: number): string {
  return '₹' + Math.round(n).toLocaleString('en-IN');
}

export function size(v: number, u: SizeUnit): string {
  return Number(v).toLocaleString('en-IN', { maximumFractionDigits: 2 }) + ' ' + UNIT_LABEL[u];
}

export function place(p: { village?: string; mandal?: string; district?: string }): string {
  const parts = [p.village, p.mandal].filter(Boolean).filter((x, i, a) => a.findIndex((y) => y!.toLowerCase() === x!.toLowerCase()) === i);
  return [...parts, p.district ? p.district + ' district' : ''].filter(Boolean).join(', ');
}

export function date(s: string | null | undefined): string {
  if (!s) return '';
  const d = new Date(s);
  return isNaN(d.getTime()) ? '' : d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function errText(e: unknown): string {
  if (e && typeof e === 'object' && 'message' in e) return String((e as { message: unknown }).message);
  return 'Something went wrong. Check your connection and try again.';
}
