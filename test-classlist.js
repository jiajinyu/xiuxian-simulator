#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

// 模拟 ClassList
class ClassList {
  constructor() {
    this._set = new Set();
  }

  add(...names) {
    names.forEach(name => this._set.add(name));
  }

  remove(...names) {
    names.forEach(name => this._set.delete(name));
  }

  contains(name) {
    return this._set.has(name);
  }
}

// 从 className 字符串初始化 classList
function initClassList(element, className) {
  if (className) {
    const classes = className.trim().split(/\s+/);
    classes.forEach(cls => {
      if (cls) element.classList.add(cls);
    });
  }
}

// 提取 HTML 中的元素和 class
function extractHtmlElements(htmlSource) {
  const elements = new Map();
  // 匹配包含 id 属性的 HTML 标签
  const regex = /<(\w+)[^>]*\bid="([^"]+)"[^>]*>/g;
  let match = regex.exec(htmlSource);
  while (match) {
    const id = match[2];
    // 提取 class 属性
    const classMatch = match[0].match(/\bclass="([^"]*)"/);
    const className = classMatch ? classMatch[1] : '';
    elements.set(id, className);
    match = regex.exec(htmlSource);
  }
  return elements;
}

// 测试
const root = path.resolve(__dirname, '.');
const htmlPath = path.join(root, 'app', 'index.html');
const htmlSource = fs.readFileSync(htmlPath, 'utf8');

const htmlElements = extractHtmlElements(htmlSource);

// 检查 btn-settle 元素
if (htmlElements.has('btn-settle')) {
  const className = htmlElements.get('btn-settle');
  console.log('btn-settle className:', className);

  // 创建模拟元素
  const element = {
    className: className,
    classList: new ClassList()
  };

  initClassList(element, className);

  console.log('btn-settle classList contains "hidden":', element.classList.contains('hidden'));
  console.log('btn-settle classList contains "btn":', element.classList.contains('btn'));

  if (element.classList.contains('hidden')) {
    console.log('✓ 测试通过：btn-settle 有 hidden 类');
    process.exit(0);
  } else {
    console.log('✗ 测试失败：btn-settle 没有 hidden 类');
    process.exit(1);
  }
} else {
  console.log('✗ 错误：找不到 btn-settle 元素');
  process.exit(1);
}
