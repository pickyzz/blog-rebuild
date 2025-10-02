import { createHighlighter } from 'shiki';
import { sanitize } from '../src/helpers/sanitize.mjs';

async function test() {
  const highlighter = await createHighlighter({ themes: ['nord'], langs: ['javascript'] });
  const code = `function add(a, b) {
  return a + b;
}

console.log(add(2,3));`;
  const html = highlighter.codeToHtml(code, { lang: 'javascript', theme: 'nord' });
  console.log('Original Shiki HTML:');
  console.log(html);
  console.log('\nSanitized HTML:');
  const sanitized = sanitize(html);
  console.log(sanitized);
  console.log('\nAre they equal?', html === sanitized);
}

test().catch(err => { console.error(err); process.exit(1); });
