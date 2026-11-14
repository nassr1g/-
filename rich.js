/* =========================================================
   rich.js — turns plain message text into safe DOM:
   @mentions, links, e-mail, phone numbers, `inline code`,
   fenced code blocks and (carefully) auto-detected code.
   Never uses innerHTML with user text.
   ========================================================= */
(function (G) {
  'use strict';

  // ---------------------------------------------------------------- tokenizer
  const TLD = 'com|net|org|io|dev|app|me|co|info|edu|gov|xyz|site|online|ly|gg|tv|ai|sa|ae|eg|kw|qa|bh|om|jo|iq|ye|sy|lb|ps|ma|dz|tn|sd|uk|us|de|fr|ru|jp|kr|cn|in|tr|ir|pk|br|es|it|nl|se|ch|cc|to|fm|ws|link|page|store|tech|blog|cloud|live|shop';
  const AR = '\\u0600-\\u06FF';
  const URL_RE = '(?:https?:\\/\\/|www\\.)[^\\s<>"\'' + AR + '«»]+';
  const MAIL_RE = '[A-Za-z0-9._%+\\-]+@[A-Za-z0-9\\-]+(?:\\.[A-Za-z0-9\\-]+)*\\.[A-Za-z]{2,}';
  const MEN_RE = '(^|[\\s(\\[{«"\'،؛:!?؟—\\-])@([A-Za-z0-9_]{3,20})(?![A-Za-z0-9_@])';
  const PHONE_RE = '(?:\\+|00)?[\\d٠-٩][\\d٠-٩\\s().\\-]{5,18}[\\d٠-٩]';
  const DOM_RE = '(?:[A-Za-z0-9](?:[A-Za-z0-9\\-]*[A-Za-z0-9])?\\.)+(?:' + TLD + ')(?![A-Za-z0-9\\-])(?:\\/[^\\s<>"\'' + AR + '«»]*)?';
  const TOKEN_SRC = '(' + URL_RE + ')|(' + MAIL_RE + ')|' + MEN_RE + '|(' + PHONE_RE + ')|(' + DOM_RE + ')';

  const count = (s, c) => s.split(c).length - 1;
  function trimTail(u) { // closing punctuation next to a link belongs to the sentence, not to the link
    let tail = '';
    while (u) {
      const c = u[u.length - 1];
      if (!/[.,;:!?)\]}'"»،؛؟…]/.test(c)) break;
      if (c === ')' && count(u, '(') >= count(u, ')')) break;
      if (c === ']' && count(u, '[') >= count(u, ']')) break;
      tail = c + tail; u = u.slice(0, -1);
    }
    return [u, tail];
  }
  const AD = { '٠': 0, '١': 1, '٢': 2, '٣': 3, '٤': 4, '٥': 5, '٦': 6, '٧': 7, '٨': 8, '٩': 9 };
  const digitsOf = (s) => s.replace(/[٠-٩]/g, (d) => AD[d]).replace(/[^\d]/g, '');
  function phoneOk(raw) {
    const plus = /^(\+|00)/.test(raw), d = digitsOf(raw);
    if (d.length < 8 || d.length > 15) return false;
    if (/^\d{4}[-.]\d{1,2}[-.]\d{1,2}$/.test(raw.trim())) return false; // looks like a date
    return plus || d[0] === '0' || d.length >= 10;
  }

  // text -> [{t:'text'|'url'|'mail'|'tel'|'men', v, href?, name?}]
  function tokenize(text) {
    const out = [], re = new RegExp(TOKEN_SRC, 'gi');
    const push = (t, v, x) => { if (v) { const last = out[out.length - 1]; if (t === 'text' && last && last.t === 'text') last.v += v; else out.push(Object.assign({ t, v }, x)); } };
    let i = 0, m;
    while ((m = re.exec(text))) {
      const at = m.index;
      const prev = at > 0 ? text[at - 1] : '';
      if (m[1] || m[6]) { // link (explicit or bare domain)
        const raw = m[1] || m[6];
        if (m[6] && /[A-Za-z0-9@.\-]/.test(prev)) continue;   // inside a word / e-mail
        const [u, tail] = trimTail(raw);
        push('text', text.slice(i, at));
        push('url', u, { href: /^https?:/i.test(u) ? u : 'https://' + u });
        push('text', tail);
        i = at + raw.length; re.lastIndex = i; continue;
      }
      if (m[2]) {
        const [u, tail] = trimTail(m[2]);
        push('text', text.slice(i, at));
        push('mail', u, { href: 'mailto:' + u });
        push('text', tail);
        i = at + m[2].length; re.lastIndex = i; continue;
      }
      if (m[4]) { // mention (m[3] is the character before it)
        push('text', text.slice(i, at) + m[3]);
        push('men', '@' + m[4], { name: m[4] });
        i = at + m[0].length; continue;
      }
      if (m[5]) {
        if (/[\w@.]/.test(prev) || /\w/.test(text[at + m[5].length] || '') || !phoneOk(m[5])) continue;
        const raw = m[5].replace(/\s+$/, '');
        push('text', text.slice(i, at));
        push('tel', raw, { href: 'tel:' + (/^(\+|00)/.test(raw) ? '+' : '') + digitsOf(raw).replace(/^00/, '') });
        i = at + raw.length; re.lastIndex = i; continue;
      }
    }
    push('text', text.slice(i));
    return out;
  }
  const mentionsUser = (text, lower) => !!lower && text.indexOf('@') >= 0 && tokenize(text).some((t) => t.t === 'men' && t.name.toLowerCase() === lower);

  // ---------------------------------------------------------------- code detection
  const CODEY = [
    /^\s*(?:function|def|class|interface|struct|enum)\s+[\w$]+/,
    /^\s*(?:const|let|var|final|int|long|double|float|char|bool|string)\s+[\w$*]+\s*(?:[=:;,(\[]|$)/,
    /^\s*(?:if|for|while|switch|catch|foreach)\s*\(.*\)\s*\{?\s*$/,
    /^\s*(?:\}\s*)?else\b\s*(?:if\b.*)?[{:]\s*$|^\s*elif\s.*:\s*$/,
    /^\s*import\s+[\w{*].*(?:from\s+['"].+['"]|;)\s*$|^\s*from\s+[\w.]+\s+import\s/,
    /^\s*return\b.*;\s*$|^\s*return\s*$|^\s{2,}return\b\s*\S/,
    /^\s*#include\s*[<"]|^\s*using\s+namespace\b|^\s*package\s+[\w.]+;?\s*$|<\?php/,
    /^\s*(?:public|private|protected|static)\s+[\w<>\[\]]+\s+[\w$]+\s*[(=;]/,
    /^\s*<\/?[a-z][\w-]*(?:\s[^>]*)?\/?>/i,
    /[;{]\s*$/, /^\s*[}\])]+[;,]?\s*$/,
    /=>|===|!==|&&|\|\||::|->|\+\+|--[^-]/,
    /^\s*[\w.$\]]+\([^)]*\)\s*;?\s*$/,
    /^\s*(?:SELECT|INSERT\s+INTO|UPDATE|DELETE\s+FROM|CREATE\s+TABLE)\b/i,
    /^\s*[.#]?[\w-]+\s*\{\s*$|^\s*[\w-]+\s*:\s*[^;]+;\s*$/
  ];
  const ONE = [
    /^\s*(?:const|let|var)\s+[\w$]+\s*=\s*\S/, /^\s*function\s+[\w$]+\s*\(.*\)/, /^\s*def\s+\w+\(.*\)\s*:/, /^\s*import\s+.+\s+from\s+['"]/,
    /^\s*(?:console\.\w+|print|System\.out\.println|echo)\s*\(.*\)\s*;?\s*$/, /^\s*SELECT\s.+\sFROM\s/i, /^\s*#include\s*[<"]/, /^\s*<\?php/,
    /^\s*<([a-z][\w-]*)(\s[^>]*)?>.*<\/\1>\s*$/i, /^\s*[\w.$]+\([^()]*\)\s*;\s*$/, /^\s*(?:npm|pnpm|yarn)\s+(?:i|install|run|add)\b/, /^\s*pip3?\s+install\s/,
    /^\s*git\s+(?:clone|commit|push|pull|checkout|add|init)\b/, /^\s*sudo\s+apt/, /^\s*\w+\s*=\s*[\w.]+\(.*\)\s*;?\s*$/
  ];
  function looksLikeCode(t) {
    t = String(t || '');
    if (t.length < 6 || t.length > 1000) return false;
    const letters = (t.match(/[A-Za-z\u0600-\u06FF]/g) || []).length, ar = (t.match(/[\u0600-\u06FF]/g) || []).length;
    if (letters && ar / letters > 0.3) return false;                // mostly Arabic text: not code
    const lines = t.split('\n').filter((l) => l.trim());
    const vis = t.replace(/\s/g, '').length, sym = (t.match(/[{}();=<>\[\]\/\\*+&|!:%$#_]/g) || []).length;
    if (lines.length >= 2) {
      if (vis && sym / vis < 0.05) return false;
      const hit = lines.filter((l) => CODEY.some((r) => r.test(l))).length;
      return hit >= 2 && hit >= Math.ceil(lines.length * 0.6);
    }
    return ONE.some((r) => r.test(t.trim()));
  }
  function detectLang(code, tag) {
    const t = String(tag || '').toLowerCase();
    const alias = { javascript: 'js', js: 'js', jsx: 'js', ts: 'js', tsx: 'js', typescript: 'js', node: 'js', mjs: 'js', python: 'py', py: 'py', sql: 'sql', mysql: 'sql', html: 'html', xml: 'html', svg: 'html', vue: 'html', css: 'css', scss: 'css', json: 'json', php: 'php', bash: 'sh', sh: 'sh', shell: 'sh', zsh: 'sh', cmd: 'sh', c: 'c', cpp: 'c', 'c++': 'c', cs: 'c', csharp: 'c', java: 'c', kotlin: 'c', go: 'c', rust: 'c', rs: 'c', swift: 'c', dart: 'c' };
    if (alias[t]) return alias[t];
    if (/<\?php/.test(code)) return 'php';
    if (/^\s*<[a-z!][\s\S]*>\s*$/i.test(code)) return 'html';
    if (/^\s*[\[{][\s\S]*[\]}]\s*$/.test(code) && /"\s*:/.test(code) && !/[;=]/.test(code)) return 'json';
    if (/^\s*(?:def |import \w|from \w+ import|elif |print\()/m.test(code) && !/[;{]\s*$/m.test(code)) return 'py';
    if (/\b(?:SELECT|INSERT INTO|UPDATE|CREATE TABLE|DELETE FROM)\b/i.test(code)) return 'sql';
    if (/#include|public static|System\.|int main|std::|fn \w+\(|func \w+\(/.test(code)) return 'c';
    if (/^\s*[.#]?[\w-]+\s*\{[^}]*:[^}]*\}/m.test(code) || /^\s*[\w-]+\s*:\s*[^;]+;\s*$/m.test(code)) return 'css';
    if (/\b(?:const|let|var|function)\b|=>|console\./.test(code)) return 'js';
    if (/^\s*(?:\$ |sudo |npm |pip |git |apt )/m.test(code)) return 'sh';
    return '';
  }
  const LANG_LABEL = { js: 'JavaScript', py: 'Python', sql: 'SQL', html: 'HTML', css: 'CSS', json: 'JSON', php: 'PHP', sh: 'Shell', c: 'Code' };

  // ---------------------------------------------------------------- syntax highlighting (small, generic)
  const KW = {
    js: 'abstract|as|async|await|break|case|catch|class|const|continue|default|delete|do|else|enum|export|extends|false|finally|for|from|function|if|implements|import|in|instanceof|interface|let|new|null|of|private|protected|public|return|static|super|switch|this|throw|true|try|typeof|undefined|var|void|while|yield',
    py: 'and|as|assert|async|await|break|class|continue|def|del|elif|else|except|False|finally|for|from|global|if|import|in|is|lambda|None|nonlocal|not|or|pass|raise|return|True|try|while|with|yield',
    c: 'auto|bool|break|case|catch|char|class|const|continue|default|do|double|else|enum|extends|false|final|finally|float|for|fn|func|if|implements|import|include|int|interface|let|long|namespace|new|null|nullptr|package|private|protected|public|return|short|static|struct|super|switch|this|throw|throws|true|try|typedef|unsigned|using|var|void|while',
    sql: 'SELECT|FROM|WHERE|INSERT|INTO|VALUES|UPDATE|SET|DELETE|CREATE|TABLE|DROP|ALTER|ADD|JOIN|LEFT|RIGHT|INNER|OUTER|ON|GROUP|BY|ORDER|LIMIT|AND|OR|NOT|NULL|AS|DISTINCT|COUNT|HAVING|LIKE|IN|IS|UNION|INDEX|PRIMARY|KEY|DEFAULT',
    sh: 'if|then|else|elif|fi|for|do|done|while|case|esac|function|in|echo|cd|export|sudo|return|exit',
    json: 'true|false|null', php: 'function|class|echo|return|if|else|elseif|foreach|for|while|new|public|private|protected|static|null|true|false|use|namespace|require|include|array',
    css: '', html: ''
  };
  const SRC = {
    cJs: '\\/\\/[^\\n]*|\\/\\*[\\s\\S]*?\\*\\/', cHash: '#[^\\n]*', cSql: '--[^\\n]*|\\/\\*[\\s\\S]*?\\*\\/', cHtml: '<!--[\\s\\S]*?-->', cCss: '\\/\\*[\\s\\S]*?\\*\\/',
    str: '"(?:\\\\.|[^"\\\\\\n])*"|\'(?:\\\\.|[^\'\\\\\\n])*\'|`(?:\\\\.|[^`\\\\])*`',
    num: '\\b\\d+(?:\\.\\d+)?\\b|#[0-9a-fA-F]{3,8}\\b', fn: '\\b[A-Za-z_$][\\w$]*(?=\\()',
    tag: '<\\/?[A-Za-z][\\w:-]*|\\/?>', attr: '\\b[\\w:-]+(?==)', prop: '[\\w-]+(?=\\s*:)'
  };
  const hlCache = {};
  function hlRegex(lang) {
    if (hlCache[lang]) return hlCache[lang];
    const parts = [];
    const add = (cls, src) => parts.push([cls, src]);
    if (lang === 'html') { add('c', SRC.cHtml); add('s', SRC.str); add('t', SRC.tag); add('a', SRC.attr); }
    else if (lang === 'css') { add('c', SRC.cCss); add('s', SRC.str); add('n', SRC.num); add('a', SRC.prop); }
    else {
      add('c', lang === 'py' || lang === 'sh' ? SRC.cHash : lang === 'sql' ? SRC.cSql : lang === 'json' ? '(?!)' : SRC.cJs);
      add('s', SRC.str);
      const kw = KW[lang] || KW.c; if (kw) add('k', '\\b(?:' + kw + ')\\b');
      add('n', SRC.num); add('f', SRC.fn);
    }
    const re = { re: new RegExp(parts.map((p) => '(' + p[1] + ')').join('|'), lang === 'sql' ? 'gi' : 'g'), cls: parts.map((p) => p[0]) };
    return (hlCache[lang] = re);
  }
  function hlSegments(code, lang) { // -> [[cls|null, text]]
    const out = [];
    if (!lang || code.length > 4000) return [[null, code]];
    const { re, cls } = hlRegex(lang);
    let i = 0, m;
    re.lastIndex = 0;
    while ((m = re.exec(code))) {
      if (!m[0]) { re.lastIndex++; continue; }
      let g = 1; while (g < m.length && m[g] === undefined) g++;
      if (m.index > i) out.push([null, code.slice(i, m.index)]);
      out.push([cls[g - 1], m[0]]);
      i = m.index + m[0].length;
    }
    if (i < code.length) out.push([null, code.slice(i)]);
    return out;
  }

  // ---------------------------------------------------------------- message structure
  // -> [{type:'text', v} | {type:'code', v, lang}]
  function splitBlocks(text) {
    const blocks = [], re = /```([A-Za-z0-9+#_.-]*)[ \t]*\r?\n?([\s\S]*?)```/g;
    let i = 0, m, any = false;
    while ((m = re.exec(text))) {
      any = true;
      if (m.index > i) blocks.push({ type: 'text', v: text.slice(i, m.index).replace(/\n$/, '') });
      blocks.push({ type: 'code', v: m[2].replace(/^\n+/, '').replace(/\s+$/, ''), lang: detectLang(m[2], m[1]) });
      i = m.index + m[0].length;
      if (text[i] === '\n') i++;
    }
    if (any) { if (i < text.length) blocks.push({ type: 'text', v: text.slice(i) }); return blocks.filter((b) => b.type === 'code' || b.v.trim()); }
    if (looksLikeCode(text)) return [{ type: 'code', v: text.replace(/^\n+/, '').replace(/\s+$/, ''), lang: detectLang(text, '') }];
    return [{ type: 'text', v: text }];
  }

  // ---------------------------------------------------------------- DOM
  const mk = (tag, cls, txt) => { const e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; };

  function inline(parent, text, ctx) {
    text.split(/(`[^`\n]{1,200}`)/).forEach((seg) => {
      if (!seg) return;
      if (seg.length > 2 && seg[0] === '`' && seg[seg.length - 1] === '`') { parent.appendChild(mk('code', 'ic', seg.slice(1, -1))); return; }
      tokenize(seg).forEach((t) => {
        if (t.t === 'text') { parent.appendChild(document.createTextNode(t.v)); return; }
        if (t.t === 'men') {
          const u = ctx && ctx.findUser ? ctx.findUser(t.name.toLowerCase()) : null;
          if (!u) { parent.appendChild(document.createTextNode(t.v)); return; }
          const s = mk('span', 'mention' + (ctx.me && ctx.me === t.name.toLowerCase() ? ' me' : ''), t.v);
          s.dataset.uid = u.uid; s.dataset.name = u.name || t.name;
          parent.appendChild(s); return;
        }
        const a = mk('a', 'lnk ' + t.t, t.v);
        a.href = t.href;
        if (t.t === 'url') { a.target = '_blank'; a.rel = 'noopener noreferrer'; }
        parent.appendChild(a);
      });
    });
  }

  function codeBlock(code, lang, ctx) {
    const wrap = mk('div', 'code-block'), head = mk('div', 'code-head');
    head.appendChild(mk('span', 'code-lang', LANG_LABEL[lang] || 'Code'));
    const btn = mk('button', 'code-copy'); btn.type = 'button';
    btn.innerHTML = '<svg viewBox="0 0 24 24" width="13" height="13"><rect x="9" y="9" width="11" height="11" rx="2.5" stroke="currentColor" stroke-width="1.9" fill="none"/><path d="M15 9V6.5A2.5 2.5 0 0 0 12.5 4h-6A2.5 2.5 0 0 0 4 6.5v6A2.5 2.5 0 0 0 6.5 15H9" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" fill="none"/></svg>';
    const lbl = mk('span', null, 'نسخ'); btn.appendChild(lbl);
    let tm = null;
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (ctx && ctx.copy) ctx.copy(code);
      btn.classList.add('done'); lbl.textContent = 'تم النسخ';
      clearTimeout(tm); tm = setTimeout(() => { btn.classList.remove('done'); lbl.textContent = 'نسخ'; }, 1500);
    });
    head.appendChild(btn);
    const sc = mk('div', 'code-scroll'), pre = mk('pre'), c = mk('code');
    hlSegments(code, lang).forEach(([cls, t]) => { if (cls) c.appendChild(mk('span', 'hl-' + cls, t)); else c.appendChild(document.createTextNode(t)); });
    pre.appendChild(c); sc.appendChild(pre);
    wrap.appendChild(head); wrap.appendChild(sc);
    return wrap;
  }

  function render(el, text, ctx) {
    el.textContent = '';
    text = String(text || '');
    splitBlocks(text).forEach((b) => {
      if (b.type === 'code') el.appendChild(codeBlock(b.v, b.lang, ctx));
      else inline(el, b.v, ctx);
    });
  }

  G.FRRich = { render, tokenize, mentionsUser, looksLikeCode, detectLang, splitBlocks, hlSegments };
})(typeof self !== 'undefined' ? self : this);
