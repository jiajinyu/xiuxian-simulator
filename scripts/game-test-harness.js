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
    this.innerText = '';
    this._innerHTML = '';
    this.style = {};
    this.disabled = false;
    this.children = [];
    this.scrollTop = 0;
    this.scrollHeight = 0;
    this.className = '';
    this.classList = new ClassList();
  }

  get innerHTML() {
    return this._innerHTML;
  }

  set innerHTML(value) {
    this._innerHTML = String(value);
    const regex = /\bid="([^"]+)"/g;
    let match = regex.exec(this._innerHTML);
    while (match) {
      this._registerById(new Element(match[1], this._registerById));
      match = regex.exec(this._innerHTML);
    }
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

function extractHtmlIds(htmlSource) {
  const ids = new Set();
  const regex = /\bid="([^"]+)"/g;
  let match = regex.exec(htmlSource);
  while (match) {
    ids.add(match[1]);
    match = regex.exec(htmlSource);
  }
  return ids;
}

function createEnvironment(options) {
  const opts = options || {};
  const elements = new Map();
  const store = new Map();
  const missingIds = new Set(Array.isArray(opts.missingIds) ? opts.missingIds : []);

  const registerById = element => {
    if (element && element.id) elements.set(element.id, element);
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
  const htmlIds = extractHtmlIds(htmlSource);
  htmlIds.forEach(id => {
    if (!missingIds.has(id)) {
      registerById(new Element(id, registerById));
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
