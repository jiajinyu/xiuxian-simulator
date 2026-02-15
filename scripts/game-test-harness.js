#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

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

class Element {
  constructor(id, registerById) {
    this.id = id || '';
    this._registerById = registerById;
    this._innerText = '';
    this._innerHTML = '';
    this.style = {};
    this.disabled = false;
    this.children = [];
    this.scrollTop = 0;
    this.scrollHeight = 0;
    this.className = '';
    this.classList = new ClassList();
  }

  get innerText() {
    return this._innerText;
  }

  set innerText(value) {
    this._innerText = String(value);
    // 同步更新 innerHTML（转义HTML特殊字符）
    this._innerHTML = this._escapeHtml(String(value));
  }

  get innerHTML() {
    return this._innerHTML;
  }

  set innerHTML(value) {
    this._innerHTML = String(value);
    // 同步更新 innerText（移除HTML标签）
    this._innerText = this._stripHtml(String(value));
    const regex = /\bid="([^"]+)"/g;
    let match = regex.exec(this._innerHTML);
    while (match) {
      this._registerById(new Element(match[1], this._registerById));
      match = regex.exec(this._innerHTML);
    }
  }

  _stripHtml(html) {
    return html.replace(/<[^>]*>/g, '');
  }

  _escapeHtml(text) {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  appendChild(child) {
    this.children.push(child);
    this.scrollHeight = this.children.length;
    this.scrollTop = this.scrollHeight;
    if (child && child.id) this._registerById(child);
  }

  insertBefore(newChild, refChild) {
    const index = this.children.indexOf(refChild);
    if (index === -1) {
      this.children.push(newChild);
    } else {
      this.children.splice(index, 0, newChild);
    }
    this.scrollHeight = this.children.length;
    this.scrollTop = this.scrollHeight;
    if (newChild && newChild.id) this._registerById(newChild);
  }
}

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
    // 提取 style 属性
    const styleMatch = match[0].match(/\bstyle="([^"]*)"/);
    const styleStr = styleMatch ? styleMatch[1] : '';
    // 解析 style 字符串为对象
    const styleObj = {};
    if (styleStr) {
      styleStr.split(';').forEach(rule => {
        const [prop, value] = rule.split(':').map(s => s.trim());
        if (prop && value) {
          // 将 kebab-case 转换为 camelCase
          const camelProp = prop.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
          styleObj[camelProp] = value;
        }
      });
    }
    elements.set(id, { className, style: styleObj });
    match = regex.exec(htmlSource);
  }
  return elements;
}

function createEnvironment(options) {
  const opts = options || {};
  const elements = new Map();
  const store = new Map();
  const missingIds = new Set(Array.isArray(opts.missingIds) ? opts.missingIds : []);

  const registerById = element => {
    if (element && element.id) elements.set(element.id, element);
  };

  // 从 className 字符串初始化 classList
  const initClassList = (element, className) => {
    if (className) {
      const classes = className.trim().split(/\s+/);
      classes.forEach(cls => {
        if (cls) element.classList.add(cls);
      });
    }
  };

  const document = {
    getElementById(id) {
      return elements.get(id) || null;
    },
    createElement() {
      return new Element('', registerById);
    },
    head: new Element('head', registerById)
  };

  const localStorage = {
    getItem(key) {
      return store.has(key) ? store.get(key) : null;
    },
    setItem(key, value) {
      store.set(key, String(value));
    },
    removeItem(key) {
      store.delete(key);
    }
  };

  const context = {
    document,
    localStorage,
    confirm: () => true,
    location: { reload: () => {} },
    setInterval: fn => {
      context.__intervalFn = fn;
      return 1;
    },
    clearInterval: () => {},
    setTimeout: (fn, _ms) => {
      if (typeof fn === 'function') fn();
      return 1;
    },
    console,
    Math: Object.create(Math)
  };

  context.Math.random = () => 0.42;
  context.window = context;

  vm.createContext(context);

  const root = path.resolve(__dirname, '..');
  const htmlPath = path.join(root, 'app', 'index.html');
  const configPath = path.join(root, 'config', 'game-config.js');
  const enginePath = path.join(root, 'src', 'game-engine.js');

  const htmlSource = fs.readFileSync(htmlPath, 'utf8');
  const htmlElements = extractHtmlElements(htmlSource);
  htmlElements.forEach((data, id) => {
    if (!missingIds.has(id)) {
      const element = new Element(id, registerById);
      element.className = data.className;
      initClassList(element, data.className);
      // 应用内联样式
      Object.assign(element.style, data.style);
      registerById(element);
    }
  });

  vm.runInContext(fs.readFileSync(configPath, 'utf8'), context, { filename: configPath });
  vm.runInContext(fs.readFileSync(enginePath, 'utf8'), context, { filename: enginePath });

  return {
    context,
    game: context.window.game,
    config: context.window.GAME_CONFIG,
    getElementById: id => document.getElementById(id)
  };
}

module.exports = {
  createEnvironment
};
