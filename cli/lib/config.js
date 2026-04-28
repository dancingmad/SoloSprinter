'use strict';
const fs   = require('fs');
const path = require('path');
const os   = require('os');

const CONFIG_FILE  = process.env.SS_CONFIG || path.join(os.homedir(), '.solosprinter-cli.json');
const MAX_INSTANCES = 3;

function load() {
  if (!fs.existsSync(CONFIG_FILE)) return { default: null, instances: {} };
  try { return JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8')); }
  catch { return { default: null, instances: {} }; }
}

function save(cfg) {
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(cfg, null, 2));
}

function listInstances() {
  return load();
}

function addInstance(alias, url) {
  const cfg = load();
  const existing = Object.keys(cfg.instances);
  if (existing.length >= MAX_INSTANCES && !cfg.instances[alias]) {
    throw new Error(
      `Maximum of ${MAX_INSTANCES} instances allowed. ` +
      `Remove one first with: ss instance remove <alias>`
    );
  }
  cfg.instances[alias] = { url: url.replace(/\/$/, '') };
  if (!cfg.default) cfg.default = alias;
  save(cfg);
  return cfg.instances[alias];
}

function removeInstance(alias) {
  const cfg = load();
  if (!cfg.instances[alias]) throw new Error(`Instance "${alias}" not found.`);
  delete cfg.instances[alias];
  if (cfg.default === alias) cfg.default = Object.keys(cfg.instances)[0] || null;
  save(cfg);
}

function setDefault(alias) {
  const cfg = load();
  if (!cfg.instances[alias]) throw new Error(`Instance "${alias}" not found.`);
  cfg.default = alias;
  save(cfg);
}

function getInstanceUrl(alias) {
  const cfg = load();
  const key = alias || cfg.default;
  if (!key) {
    throw new Error(
      'No instance configured. Add one with:\n  ss instance add <alias> <url>\n' +
      'Example: ss instance add local http://localhost:3001'
    );
  }
  const inst = cfg.instances[key];
  if (!inst) throw new Error(`Instance "${key}" not found. Run: ss instance list`);
  return inst.url;
}

module.exports = { listInstances, addInstance, removeInstance, setDefault, getInstanceUrl, MAX_INSTANCES };
