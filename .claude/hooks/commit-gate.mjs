#!/usr/bin/env node
// ==================== 提交门卫（Claude Code PreToolUse hook 脚本） ====================
// 作用：拦住"没做体检就提交"的 git commit。只有 .git/quality-gates/ 里两张"通过标记"
// （测试通过 + 质检通过）都新鲜有效（1 小时内），才放行提交——这是"提交前强制体检"的门。
//
// 工作原理：
//   1. Claude Code 每次执行 Bash 工具调用前，会把调用信息以 JSON 形式喂给本脚本（stdin）
//   2. 本脚本只看这条命令是不是 "git commit"（含 -m/-a/--amend 等变体和 && 链式命令）
//   3. 不是提交 → 立即放行（绝不能拖慢正常干活）；是提交 → 检查两张标记
//   4. 标记齐全且未过期 → 放行；否则 stderr 输出中文提示 + 退出码 2 拦截提交
//
// 设计红线（重要）：
//   - fail-open（宁可漏拦不可误伤）：JSON 解析失败、不在 git 仓库、git 命令跑不动……
//     一切意外情况一律放行。门卫的意义是拦住"忘体检"，而不是把 Claude Code 卡死。
//   - 只读不改：本脚本绝不写文件、不联网。标记的写入由 git-commit-agent 负责。
//   - 放行时 stdout 保持安静（hook 的 stdout 会被 Claude Code 解析，杂音会污染结果）；
//     拦截时提示写 stderr（官方文档保证 stderr 一定回传给 Claude 和用户）。
//
// 用法：
//   node commit-gate.mjs            正常模式：从 stdin 读 JSON，判定放行/拦截
//   node commit-gate.mjs --selftest 自检模式：跑一组内置用例验证判定逻辑（不写任何文件）

import { spawnSync } from 'node:child_process';
import { readFileSync, statSync } from 'node:fs';
import { resolve } from 'node:path';

/* ---------- 常量：标记与时效规则 ---------- */
// 机器只认"文件存在 + 修改时间新鲜"：
//   - 修改时间在 [现在-60分钟, 现在+5分钟] 内 → 有效
//   - +5 分钟是给"两台电脑时钟差几秒"留的容差；超过 5 分钟视为伪造 → 拦
const MARKERS = ['test-pass.mark', 'quality-pass.mark'];  // 测试通过标记 / 质检通过标记
const MAX_AGE_MS = 60 * 60 * 1000;        // 有效期：1 小时
const FUTURE_TOLERANCE_MS = 5 * 60 * 1000; // 未来容差：5 分钟（防时钟偏差误拦）

/* ---------- 常量：git commit 命令识别正则 ---------- */
// 两条正则，大小写不敏感：
//   R1 匹配 git commit 及其变体（-m/-a/--amend/--no-verify/--allow-empty……），
//      也匹配 "git add . && git commit ..." 这类链式命令（正则不要求从头开始）
//   R2 匹配 "git -C 子目录 commit ..." 的写法
//   (?!-(?:graph|tree)\b) 排除 git commit-graph / git commit-tree（那是维护命令，不是提交）
//   (?=\s|$) 保证 commit 是完整单词，避免误伤 "git commitx" 之类
const COMMIT_RES = [
  /\bgit\s+commit(?!-(?:graph|tree)\b)(?=\s|$)/i,
  /\bgit\s+-C\s+\S+\s+commit(?!-(?:graph|tree)\b)(?=\s|$)/i,
];

/* ---------- 小工具函数 ---------- */
// 立刻放行（退出码 0，stdout 不输出任何东西）
function allow() { process.exit(0); }

// 判断一条命令是不是 git commit（供主流程和自检共用）
function isCommitCommand(command) {
  return COMMIT_RES.some(re => re.test(command));
}

// 判定单个标记的状态：missing(文件不存在) / stale(过期) / future(时间在未来) / ok(有效)
function markerVerdict(mtimeMs, nowMs) {
  if (mtimeMs === null) return 'missing';
  if (mtimeMs > nowMs + FUTURE_TOLERANCE_MS) return 'future'; // 未来超 5 分钟 → 疑似伪造
  if (mtimeMs < nowMs - MAX_AGE_MS) return 'stale';           // 超 1 小时 → 过期
  return 'ok';
}

/* ---------- 自检模式：验证判定逻辑（不写任何文件） ---------- */
function runSelfTest() {
  // 一组用例：[用例说明, 实际值, 期望值]
  const now = Date.now();
  const cases = [
    // —— git commit 命令识别 ——
    ['识别 普通提交', isCommitCommand('git commit -m "存档"'), true],
    ['识别 无参数提交', isCommitCommand('git commit'), true],
    ['识别 链式命令里的提交', isCommitCommand('git add . && git commit -m x'), true],
    ['识别 --amend 补交', isCommitCommand('git commit --amend --no-edit'), true],
    ['识别 --allow-empty', isCommitCommand('git commit --allow-empty -m t'), true],
    ['识别 git -C 子目录提交', isCommitCommand('git -C docs commit -m x'), true],
    ['排除 commit-graph 维护命令', isCommitCommand('git commit-graph write'), false],
    ['排除 commit-tree 管道命令', isCommitCommand('git commit-tree abc'), false],
    ['排除 其他 git 命令', isCommitCommand('git checkout -b dev'), false],
    ['排除 push', isCommitCommand('git push origin main'), false],
    ['排除 单词含 commit 的非命令', isCommitCommand('echo mycommitment'), false],
    // —— 标记时效判定 ——
    ['标记 刚生成 → 有效', markerVerdict(now, now), 'ok'],
    ['标记 30 分钟前 → 有效', markerVerdict(now - 30 * 60 * 1000, now), 'ok'],
    ['标记 61 分钟前 → 过期', markerVerdict(now - 61 * 60 * 1000, now), 'stale'],
    ['标记 3 分钟后（时钟偏差）→ 有效', markerVerdict(now + 3 * 60 * 1000, now), 'ok'],
    ['标记 10 分钟后 → 疑似伪造', markerVerdict(now + 10 * 60 * 1000, now), 'future'],
    ['标记 文件不存在', markerVerdict(null, now), 'missing'],
  ];
  let failed = 0;
  for (const [label, got, want] of cases) {
    const pass = got === want;
    if (!pass) failed++;
    console.log(`${pass ? 'PASS' : 'FAIL'}  ${label}（期望 ${want}，实际 ${got}）`);
  }
  console.log(failed === 0
    ? `\n自检全部通过（${cases.length} 项）✅`
    : `\n自检有 ${failed} 项失败 ❌`);
  process.exit(failed === 0 ? 0 : 1);
}

/* ---------- 入口：自检模式优先，否则走正常门卫流程 ---------- */
if (process.argv.includes('--selftest')) {
  runSelfTest();
}

/* ---------- 1. 解析 Claude Code 喂进来的 JSON ---------- */
// 结构示例：{"hook_event_name":"PreToolUse","tool_name":"Bash",
//            "tool_input":{"command":"git commit -m x"},"cwd":"项目目录"}
let input = {};
try {
  const raw = readFileSync(0, 'utf8').replace(/^﻿/, ''); // 去掉可能的 BOM 头（﻿ 是零宽字符）
  if (raw.trim()) input = JSON.parse(raw);
} catch {
  allow(); // JSON 解析失败（如 stdin 为空）→ 放行，门卫坏了绝不能卡死 Claude Code
}

/* ---------- 2. 只盯 PreToolUse + Bash 工具 ---------- */
if (input.hook_event_name !== 'PreToolUse') allow();
if (input.tool_name !== 'Bash' && input.tool_name !== 'PowerShell') allow();
const command = input.tool_input && typeof input.tool_input.command === 'string'
  ? input.tool_input.command : '';
if (!command) allow();

/* ---------- 3. 不是 git commit → 放行 ---------- */
if (!isCommitCommand(command)) allow();

/* ---------- 4. 定位 git 仓库目录（.git 文件夹） ---------- */
// 用 stdin 里的 cwd（工具调用的工作目录）当起点问 git，比猜路径可靠得多
const cwd = typeof input.cwd === 'string' && input.cwd ? input.cwd : process.cwd();
const rev = spawnSync('git', ['rev-parse', '--git-dir'], { cwd, encoding: 'utf8', timeout: 5000 });
if (rev.status !== 0 || !rev.stdout.trim()) allow(); // 不是 git 仓库 → 没有门禁可言
const gatesDir = resolve(resolve(cwd, rev.stdout.trim()), 'quality-gates');

/* ---------- 5. 检查两张通过标记 ---------- */
const now = Date.now();
const problems = [];
for (const name of MARKERS) {
  let mtimeMs;
  try { mtimeMs = statSync(resolve(gatesDir, name)).mtimeMs; }
  catch { mtimeMs = null; } // 文件不存在（或其他读不到的情况）→ 按缺失处理
  const verdict = markerVerdict(mtimeMs, now);
  if (verdict !== 'ok') problems.push({ name, verdict });
}

if (problems.length === 0) allow(); // 两张标记都新鲜有效 → 放行

/* ---------- 6. 拦截：stderr 中文提示 + 退出码 2 ---------- */
// 官方约定：退出码 2 = 拦截（阻塞），stderr 的内容会回传给 Claude 和用户
const VERDICT_DESC = { missing: '不存在', stale: '已超过 1 小时有效期', future: '时间在未来（异常）' };
const detail = problems.map(p => `${p.name}（${VERDICT_DESC[p.verdict]}）`).join('；');
process.stderr.write(
  `【提交门禁】拦住了这次 git commit——缺少有效的测试/质检通过标记：${detail}。\n` +
  '请对 Claude 说"提交代码"，会先自动派测试代理和质量检查代理体检，通过后自动提交；\n' +
  '如情况紧急，明确说"跳过检查直接提交"，可走应急通道。\n'
);
process.exit(2);
