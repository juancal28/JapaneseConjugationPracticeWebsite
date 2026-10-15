declare module "wanakana" {
  export function bind(element: HTMLInputElement | HTMLTextAreaElement, options?: Record<string, unknown>): void;
  export function unbind(element: HTMLInputElement | HTMLTextAreaElement): void;
  export function isHiragana(input?: string): boolean;
  export function isKatakana(input?: string): boolean;
  export function isKanji(input?: string): boolean;
  export function isKana(input?: string): boolean;
  export function toHiragana(input?: string, options?: Record<string, unknown>): string;
  export function toKatakana(input?: string, options?: Record<string, unknown>): string;
}
