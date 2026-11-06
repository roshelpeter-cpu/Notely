function inlineText(nodes = []) {
  return nodes
    .map((node) => {
      if (node.type === 'hardBreak') return '\n';
      if (node.type !== 'text') return '';
      let text = node.text || '';
      const marks = node.marks || [];
      if (marks.some((mark) => mark.type === 'code')) text = `\`${text}\``;
      if (marks.some((mark) => mark.type === 'bold')) text = `**${text}**`;
      if (marks.some((mark) => mark.type === 'italic')) text = `*${text}*`;
      if (marks.some((mark) => mark.type === 'strike')) text = `~~${text}~~`;
      if (marks.some((mark) => mark.type === 'underline')) text = `<u>${text}</u>`;
      const link = marks.find((mark) => mark.type === 'link');
      if (link?.attrs?.href) text = `[${text}](${link.attrs.href})`;
      return text;
    })
    .join('');
}

function renderBlocks(nodes = [], indent = '') {
  return nodes
    .map((node) => {
      if (node.type === 'heading') {
        const level = Math.min(Math.max(Number(node.attrs?.level) || 1, 1), 3);
        return `${'#'.repeat(level)} ${inlineText(node.content)}`;
      }
      if (node.type === 'paragraph') return `${indent}${inlineText(node.content)}`;
      if (node.type === 'blockquote') {
        const inner = renderBlocks(node.content).split('\n').map((line) => `> ${line}`).join('\n');
        return inner;
      }
      if (node.type === 'codeBlock') {
        const code = (node.content || []).map((child) => child.text || '').join('');
        return `\`\`\`${node.attrs?.language || ''}\n${code}\n\`\`\``;
      }
      if (node.type === 'horizontalRule') return '---';
      if (node.type === 'bulletList') {
        return (node.content || [])
          .map((item) => `- ${renderBlocks(item.content).replace(/\n/g, '\n  ')}`)
          .join('\n');
      }
      if (node.type === 'orderedList') {
        return (node.content || [])
          .map((item, index) => `${index + 1}. ${renderBlocks(item.content).replace(/\n/g, '\n   ')}`)
          .join('\n');
      }
      if (node.type === 'taskList') {
        return (node.content || [])
          .map((item) => `- [${item.attrs?.checked ? 'x' : ' '}] ${renderBlocks(item.content).replace(/\n/g, '\n  ')}`)
          .join('\n');
      }
      if (node.type === 'image') return node.attrs?.alt ? `![${node.attrs.alt}](image)` : '';
      return inlineText(node.content);
    })
    .filter((block) => block !== '')
    .join('\n\n');
}

export function docToMarkdown(doc) {
  return `${renderBlocks(doc?.content || []).trim()}\n`;
}

function parseInline(text) {
  const nodes = [];
  const pattern = /(<u>.*?<\/u>)|(`[^`]+`)|(\*\*[^*]+\*\*)|(~~[^~]+~~)|(\*[^*]+\*)|(\[[^\]]+\]\([^)]+\))/g;
  let last = 0;
  for (const match of text.matchAll(pattern)) {
    if (match.index > last) nodes.push({ type: 'text', text: text.slice(last, match.index) });
    const token = match[0];
    if (token.startsWith('<u>')) {
      nodes.push({ type: 'text', text: token.slice(3, -4), marks: [{ type: 'underline' }] });
    } else if (token.startsWith('`')) {
      nodes.push({ type: 'text', text: token.slice(1, -1), marks: [{ type: 'code' }] });
    } else if (token.startsWith('**')) {
      nodes.push({ type: 'text', text: token.slice(2, -2), marks: [{ type: 'bold' }] });
    } else if (token.startsWith('~~')) {
      nodes.push({ type: 'text', text: token.slice(2, -2), marks: [{ type: 'strike' }] });
    } else if (token.startsWith('*')) {
      nodes.push({ type: 'text', text: token.slice(1, -1), marks: [{ type: 'italic' }] });
    } else {
      const link = /\[([^\]]+)\]\(([^)]+)\)/.exec(token);
      nodes.push({
        type: 'text',
        text: link[1],
        marks: [{ type: 'link', attrs: { href: link[2] } }],
      });
    }
    last = match.index + token.length;
  }
  if (last < text.length) nodes.push({ type: 'text', text: text.slice(last) });
  return nodes.filter((node) => node.text !== '');
}

function isBlockStart(line) {
  return (
    /^(#{1,3})\s+/.test(line) ||
    line.startsWith('```') ||
    line.startsWith('> ') ||
    /^[-*]\s+\[[ xX]\]\s+/.test(line) ||
    /^[-*]\s+/.test(line) ||
    /^\d+\.\s+/.test(line) ||
    /^(---|\*\*\*)$/.test(line.trim())
  );
}

export function markdownToDoc(markdown) {
  const lines = String(markdown || '').replace(/\r\n/g, '\n').replace(/^\uFEFF/, '').split('\n');
  const content = [];
  let index = 0;

  while (index < lines.length) {
    const line = lines[index];
    if (!line.trim()) {
      index += 1;
      continue;
    }
    if (/^(---|\*\*\*)$/.test(line.trim())) {
      content.push({ type: 'horizontalRule' });
      index += 1;
      continue;
    }
    const heading = /^(#{1,3})\s+(.*)$/.exec(line);
    if (heading) {
      content.push({
        type: 'heading',
        attrs: { level: heading[1].length },
        content: parseInline(heading[2].trim()),
      });
      index += 1;
      continue;
    }
    if (line.startsWith('```')) {
      const language = line.slice(3).trim() || null;
      const code = [];
      index += 1;
      while (index < lines.length && !lines[index].startsWith('```')) {
        code.push(lines[index]);
        index += 1;
      }
      if (index < lines.length) index += 1;
      content.push({
        type: 'codeBlock',
        attrs: { language },
        content: code.length ? [{ type: 'text', text: code.join('\n') }] : [],
      });
      continue;
    }
    if (line.startsWith('> ')) {
      const quoted = [];
      while (index < lines.length && lines[index].startsWith('> ')) {
        quoted.push(lines[index].slice(2));
        index += 1;
      }
      content.push({
        type: 'blockquote',
        content: [{ type: 'paragraph', content: parseInline(quoted.join(' ')) }],
      });
      continue;
    }
    if (/^[-*]\s+\[[ xX]\]\s+/.test(line)) {
      const items = [];
      while (index < lines.length && /^[-*]\s+\[[ xX]\]\s+/.test(lines[index])) {
        const checked = /^[-*]\s+\[[xX]\]/.test(lines[index]);
        const text = lines[index].replace(/^[-*]\s+\[[ xX]\]\s+/, '');
        items.push({
          type: 'taskItem',
          attrs: { checked },
          content: [{ type: 'paragraph', content: parseInline(text) }],
        });
        index += 1;
      }
      content.push({ type: 'taskList', content: items });
      continue;
    }
    if (/^[-*]\s+/.test(line)) {
      const items = [];
      while (index < lines.length && /^[-*]\s+/.test(lines[index]) && !/^[-*]\s+\[[ xX]\]\s+/.test(lines[index])) {
        items.push({
          type: 'listItem',
          content: [{ type: 'paragraph', content: parseInline(lines[index].replace(/^[-*]\s+/, '')) }],
        });
        index += 1;
      }
      content.push({ type: 'bulletList', content: items });
      continue;
    }
    if (/^\d+\.\s+/.test(line)) {
      const items = [];
      while (index < lines.length && /^\d+\.\s+/.test(lines[index])) {
        items.push({
          type: 'listItem',
          content: [{ type: 'paragraph', content: parseInline(lines[index].replace(/^\d+\.\s+/, '')) }],
        });
        index += 1;
      }
      content.push({ type: 'orderedList', attrs: { start: 1 }, content: items });
      continue;
    }

    const paragraph = [line.trim()];
    index += 1;
    while (index < lines.length && lines[index].trim() && !isBlockStart(lines[index])) {
      paragraph.push(lines[index].trim());
      index += 1;
    }
    content.push({ type: 'paragraph', content: parseInline(paragraph.join(' ')) });
  }

  if (!content.length) content.push({ type: 'paragraph' });
  return { type: 'doc', content };
}

export function parseMarkdownFile(filename, markdown) {
  const text = String(markdown || '').replace(/\r\n/g, '\n').replace(/^\uFEFF/, '');
  const lines = text.split('\n');
  let title = '';
  let body = text;
  if (lines[0]?.startsWith('# ')) {
    title = lines[0].slice(2).trim();
    body = lines.slice(lines[1] === '' ? 2 : 1).join('\n');
  }
  if (!title) {
    title = String(filename || 'Imported note')
      .replace(/\.md$/i, '')
      .replace(/[-_]+/g, ' ')
      .trim() || 'Imported note';
  }
  return { title: title.slice(0, 200), contentJson: markdownToDoc(body) };
}
