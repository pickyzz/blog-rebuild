// Minimal copy-to-clipboard for pre > code blocks
// Provide a safe global stub in case legacy markup still calls onclick="copyCodeBlock(this)"
// This avoids ReferenceError until our script re-wires buttons.
try { if (typeof window !== 'undefined' && !window.copyCodeBlock) { window.copyCodeBlock = function(){ /* no-op (legacy inline handler) */ }; } } catch(_) {}

(function(){
  function createButton(){
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'copy-btn';
  btn.setAttribute('aria-label','Copy code');
    // filled clipboard SVG + label
    btn.innerHTML = '' +
      '<svg aria-hidden="true" viewBox="0 0 24 24" class="icon-svg" xmlns="http://www.w3.org/2000/svg" fill="currentColor">' +
        '<path d="M16 4h-3.5l-.71-.71A1 1 0 0010.79 3H7a2 2 0 00-2 2v14a2 2 0 002 2h10a2 2 0 002-2V6a2 2 0 00-2-2zM12 5.5A1.5 1.5 0 1110.5 4 1.5 1.5 0 0112 5.5z" />' +
      '</svg>' +
      '<span class="icon-label">Copy</span>';
    return btn;
  }

  function copyText(text){
    if(navigator.clipboard && navigator.clipboard.writeText){
      return navigator.clipboard.writeText(text);
    }
    return new Promise(function(resolve, reject){
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.setAttribute('readonly','');
      ta.style.position = 'absolute';
      ta.style.left = '-9999px';
      document.body.appendChild(ta);
      const sel = document.getSelection();
      const range = document.createRange();
      range.selectNodeContents(ta);
      sel.removeAllRanges();
      sel.addRange(range);
      try {
        document.execCommand('copy');
        sel.removeAllRanges();
        document.body.removeChild(ta);
        resolve();
      } catch (err) {
        document.body.removeChild(ta);
        reject(err);
      }
    });
  }

  function attachCopyButtons(){
    // First, handle Notion-style blocks which may already have a header and copy button
    const notionBlocks = document.querySelectorAll('.notion-code-block');
    notionBlocks.forEach(block => {
      // If there's already a copy-button in header, wire it up; otherwise create one inside header
      const header = block.querySelector('.code-header');
      if(!header) return;
  let btn = header.querySelector('.copy-button');
      const code = block.querySelector('pre > code');
      if(!code) return;
      if(!btn){
        btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'copy-button';
  btn.setAttribute('aria-label','Copy code');
        btn.innerHTML = '' +
          '<svg aria-hidden="true" viewBox="0 0 24 24" class="icon-svg" xmlns="http://www.w3.org/2000/svg" fill="currentColor">' +
            '<path d="M16 4h-3.5l-.71-.71A1 1 0 0010.79 3H7a2 2 0 00-2 2v14a2 2 0 002 2h10a2 2 0 002-2V6a2 2 0 00-2-2zM12 5.5A1.5 1.5 0 1110.5 4 1.5 1.5 0 0112 5.5z" />' +
          '</svg>' +
          '<span class="icon-label">Copy</span>';
        header.appendChild(btn);
      } else {
        // existing server-rendered button: ensure it has icon + label
        if(!btn.querySelector('.icon-svg')){
          const existingText = (btn.textContent || '').trim();
          const label = existingText || 'Copy';
          btn.innerHTML = '' +
            '<svg aria-hidden="true" viewBox="0 0 24 24" class="icon-svg" xmlns="http://www.w3.org/2000/svg" fill="currentColor">' +
              '<path d="M16 4h-3.5l-.71-.71A1 1 0 0010.79 3H7a2 2 0 00-2 2v14a2 2 0 002 2h10a2 2 0 002-2V6a2 2 0 00-2-2zM12 5.5A1.5 1.5 0 1110.5 4 1.5 1.5 0 0112 5.5z" />' +
            '</svg>' +
            '<span class="icon-label">' + label + '</span>';
        }
      }
  // Remove old inline onclick to avoid ReferenceError and double-handling
  try { btn.onclick = null; btn.removeAttribute('onclick'); } catch(_) {}
  if(btn.__code_copy_attached) return;
      btn.__code_copy_attached = true;
        btn.addEventListener('click', function(){
          const text = code.innerText.replace(/\u00A0/g,' ');
          copyText(text).then(function(){
              // show transient visual state via class and update label to user-requested text
              const labelSpan = btn.querySelector && btn.querySelector('.icon-label');
              const origLabel = labelSpan ? labelSpan.textContent : null;
              if (labelSpan) labelSpan.textContent = 'copied';
              btn.classList.add('copied');
              btn.setAttribute('data-copied','true');
              setTimeout(function(){
                if (labelSpan && origLabel != null) labelSpan.textContent = origLabel;
                btn.classList.remove('copied');
                btn.removeAttribute('data-copied');
              }, 1200);
            }).catch(function(){
            // add a brief error state via class; keep it subtle
            btn.classList.add('copy-error');
            setTimeout(function(){
              btn.classList.remove('copy-error');
            }, 1200);
          });
        });
    });

    // Fallback: generic pre > code blocks
    const codes = document.querySelectorAll('pre > code');
    codes.forEach(code => {
      const pre = code.parentElement;
      if(!pre) return;
      // skip if this code is inside a notion block (already handled)
      if(pre.closest('.notion-code-block')) return;
      let wrapper = pre.closest('.code-block');
      if(!wrapper){
        wrapper = document.createElement('div');
        wrapper.className = 'code-block';
        pre.parentNode.insertBefore(wrapper, pre);
        wrapper.appendChild(pre);
      }
      if(wrapper.querySelector('.copy-btn')) return;
      const btn = createButton();
      wrapper.appendChild(btn);

      btn.addEventListener('click', function(){
        const text = code.innerText.replace(/\u00A0/g,' ');
        copyText(text).then(function(){
          const labelSpan = btn.querySelector && btn.querySelector('.icon-label');
          const origLabel = labelSpan ? labelSpan.textContent : null;
          if (labelSpan) labelSpan.textContent = 'copied';
          btn.classList.add('copied');
          btn.setAttribute('data-copied','true');
          setTimeout(function(){
            if (labelSpan && origLabel != null) labelSpan.textContent = origLabel;
            btn.classList.remove('copied');
            btn.removeAttribute('data-copied');
          }, 1200);
        }).catch(function(){
          btn.classList.add('copy-error');
          setTimeout(function(){
            btn.classList.remove('copy-error');
          }, 1200);
        });
      });

      btn.addEventListener('keydown', function(e){
        if(e.key === 'Enter' || e.key === ' '){
          e.preventDefault();
          btn.click();
        }
      });
    });
  }

  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', attachCopyButtons);
  } else {
    attachCopyButtons();
  }

  // expose for dynamic content
  window.__attachCodeCopy = attachCopyButtons;

  // Re-attach after Astro client navigations
  document.addEventListener('astro:page-load', attachCopyButtons);
  document.addEventListener('astro:after-swap', attachCopyButtons);
})();
