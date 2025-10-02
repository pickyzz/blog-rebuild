import { createHighlighter } from 'shiki';

async function test() {
  const highlighter = await createHighlighter({ themes: ['nord'], langs: ['javascript'] });
  const code = `function add(a, b) {
  return a + b;
}

console.log(add(2,3));`;
  const html = highlighter.codeToHtml(code, { lang: 'javascript', theme: 'nord' });
  console.log(html);
}

test().catch(err => { console.error(err); process.exit(1); });
