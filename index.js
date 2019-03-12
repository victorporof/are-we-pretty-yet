import path from 'path';
import fs from 'fs';

import shell from 'shelljs';

import OPTIONS from './options';
import TASKS from './tasks';

const DRY_RUN = false;

const SRC_REPO = 'https://github.com/mozilla/gecko-dev.git';
const SRC_EXTENSIONS = ['js', 'jsm', 'jsx'];
const SRC_GLOB = `**/*.{${SRC_EXTENSIONS.join(',')}}`;

const SRC_DIR = path.join(__dirname, '.clone');
const OUT_DIR = path.join(__dirname, 'logs');

const LOG_BASENAME = ({ bin }, setting) => `${bin} ${setting.join(' ')}`.trim();
const GIT_DIFFSTAT_OUT_FILE = (...args) => path.join(OUT_DIR, `${LOG_BASENAME(...args)}.git.diffstat.out.log`);
const GIT_DIFF_OUT_FILE = (...args) => path.join(OUT_DIR, `${LOG_BASENAME(...args)}.git.diff.out.log`);
const GIT_RESET_ERR_FILE = (...args) => path.join(OUT_DIR, `${LOG_BASENAME(...args)}.git.reset.err.log`);
const TASK_OUT_FILE = (...args) => path.join(OUT_DIR, `${LOG_BASENAME(...args)}.task.out.log`);
const TASK_ERR_FILE = (...args) => path.join(OUT_DIR, `${LOG_BASENAME(...args)}.task.err.log`);

const exec = (command, cwd = '.') => {
  console.info('>', command);
  if (!DRY_RUN) {
    shell.exec(command, { cwd });
  }
};

const prepare = () => {
  exec(`rm -r ${OUT_DIR}`);
  exec(`mkdir ${OUT_DIR}`);
};

const clone = () => {
  exec(`rm -r ${SRC_DIR}`);
  exec(`git clone ${SRC_REPO} ${SRC_DIR}`);
};

const diffstat = ({ bin }, setting) => {
  const out = GIT_DIFFSTAT_OUT_FILE({ bin }, setting);
  exec(`git diff --stat --stat-width=32767 > "${out}"`, SRC_DIR);
};

const diff = ({ bin }, setting) => {
  const out = GIT_DIFF_OUT_FILE({ bin }, setting);
  exec(`git diff > "${out}"`, SRC_DIR);
};

const reset = ({ bin }, setting, glob) => {
  const err = GIT_RESET_ERR_FILE({ bin }, setting);
  exec(`git checkout HEAD -- ${glob} 2>> "${err}"`, SRC_DIR);
};

const revert = () => {
  exec('git reset --hard', SRC_DIR);
};

const prettify = ({ bin, args }, setting, ignored) => {
  const cmd = `${bin} ${args.join(' ').replace(/\$0/gi, SRC_GLOB)} ${setting.join(' ')}`;
  const out = TASK_OUT_FILE({ bin }, setting);
  const err = TASK_ERR_FILE({ bin }, setting);
  exec(`${cmd} > "${out}" 2>> "${err}"`, SRC_DIR);

  ignored.forEach(glob => reset({ bin }, setting, glob));
};

const sanitize = () => {
  SRC_EXTENSIONS.forEach(ext => exec(`find . -type d -name "*.${ext}" | xargs rm -r`, SRC_DIR));
};

const analyze = (task, setting, ignored) => {
  sanitize();
  prettify(task, setting, ignored);
  diffstat(task, setting);
  diff(task, setting);
  revert();
};

const runOption = (task, [option, variants], ignored) => {
  variants.forEach(variant => analyze(task, [option, variant], ignored));
};

const runTask = ([tool, task], ignored) => {
  analyze(task, [], ignored);
  Object.entries(OPTIONS[tool]).forEach(entry => runOption(task, entry, ignored));
};

const main = () => {
  prepare();
  clone();

  const eslintignore = fs.readFileSync(path.join(SRC_DIR, '.eslintignore'), 'utf-8');
  const ignored = eslintignore.split('\n').filter(e => e.trim() && !e.match(/^[!#]/));

  Object.entries(TASKS).forEach(entry => runTask(entry, ignored));
};

main();
