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
  constructor(id) {
    this.id = id;
    this.innerText = '';
    this.innerHTML = '';
    this.style = {};
    this.disabled = false;
    this.children = [];
    this.scrollTop = 0;
    this.scrollHeight = 0;
    this.classList = new ClassList();
  }

  appendChild(child) {
    this.children.push(child);
    this.scrollHeight = this.children.length;
    this.scrollTop = this.scrollHeight;
  }
}

function createEnvironment() {
  const elements = new Map();
  const store = new Map();

  const document = {
    getElementById(id) {
      if (!elements.has(id)) {
        elements.set(id, new Element(id));
      }
      return elements.get(id);
    },
    createElement(tagName) {
      return new Element(tagName);
    }
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
    setTimeout: (fn, ms) => {
      // 立即执行，用于测试
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
  const configPath = path.join(root, 'config', 'game-config.js');
  const enginePath = path.join(root, 'src', 'game-engine.js');

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
