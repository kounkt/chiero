// 中のページの最初の画面：トップと同じ水母を出す（field.js を読むだけ）。
import { initField } from './field.js?v=c887f99ac342';

const start = () => setTimeout(initField, 120);
if (document.readyState === 'complete') start(); else addEventListener('load', start, { once: true });
