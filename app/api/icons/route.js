import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

function walk(dir, baseUrl = '/icons') {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const categories = [];
  let files = [];
  for (const entry of entries) {
    if (entry.name.startsWith('.')) continue;
    const fullPath = path.join(dir, entry.name);
    const publicUrl = `${baseUrl}/${entry.name}`;
    if (entry.isDirectory()) {
      const sub = walk(fullPath, publicUrl);
      if (sub.type === 'category') categories.push(sub);
      else files = files.concat(sub.files);
    } else if (/\.(svg|png|jpg|jpeg|webp)$/i.test(entry.name)) {
      files.push(publicUrl);
    }
  }
  if (categories.length > 0) {
    return { type: 'category', categories };
  }
  return { type: 'files', files };
}

function flattenToCategories(root, name = 'Icons') {
  if (root.type === 'files') {
    return [{ name, icons: root.files.sort() }];
  }
  // type === 'category'
  const out = [];
  for (const node of root.categories) {
    const display = node.categories ? node.categories.length > 0 : false;
    const childName = node.type === 'category' ? undefined : undefined;
  }
  // Recursively convert each subfolder to a category
  const stack = [{ node: root, prefix: '' }];
  while (stack.length) {
    const { node, prefix } = stack.pop();
    if (node.type === 'files') {
      out.push({ name: prefix || name, icons: node.files.sort() });
    } else if (node.type === 'category') {
      for (const sub of node.categories) {
        if (sub.type === 'files') {
          const firstFile = sub.files[0] || '';
          const folder = firstFile.split('/').slice(0, -1).join('/');
          const folderName = folder.split('/').pop() || 'Icons';
          out.push({ name: folderName, icons: sub.files.sort() });
        } else {
          // push deeper
          stack.push({ node: sub, prefix });
        }
      }
    }
  }
  // merge categories with same name
  const merged = {};
  for (const c of out) {
    if (!merged[c.name]) merged[c.name] = new Set();
    c.icons.forEach((i) => merged[c.name].add(i));
  }
  return Object.entries(merged).map(([name, set]) => ({ name, icons: Array.from(set).sort() }));
}

export async function GET() {
  try {
    const rootDir = path.join(process.cwd(), 'public', 'icons');
    if (!fs.existsSync(rootDir)) {
      return NextResponse.json({ categories: [] }, { status: 200 });
    }
    const tree = walk(rootDir, '/icons');
    const categories = flattenToCategories(tree);
    return NextResponse.json({ categories }, { status: 200, headers: { 'Cache-Control': 'public, max-age=60' } });
  } catch (e) {
    return NextResponse.json({ categories: [], error: String(e?.message || e) }, { status: 200 });
  }
}


