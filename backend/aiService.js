/**
 * AI 服务模块
 * 调用大语言模型 API 生成范文和个人提升建议
 * 密钥由前端传入，不存储在服务器
 */

const OpenAI = require("openai");

/**
 * 生成优化后的简历范文
 */
async function generateOptimizedResume(resumeText, targetJd, extraInfo, suggestions, apiKey, apiBaseUrl, apiModel, aiPrompt) {
  if (!apiKey) {
    return { success: false, error: "未提供 API 密钥" };
  }

  var systemPrompt = buildSystemPrompt();
  var userPrompt = aiPrompt || buildUserPrompt(resumeText, targetJd, extraInfo, suggestions);

  try {
    var client = new OpenAI({
      apiKey: apiKey,
      baseURL: apiBaseUrl || "https://api.deepseek.com"
    });

    var model = apiModel || "deepseek-chat";
    var response = await client.chat.completions.create({
      model: model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
      ],
      temperature: 0.7,
      max_tokens: 4000
    });

    var content = response.choices[0].message.content;
    return { success: true, content: content };
  } catch (e) {
    return { success: false, error: "AI 调用失败：" + e.message };
  }
}

/**
 * 生成个人提升建议
 */
async function generateImprovementPlan(resumeText, targetJd, extraInfo, scores, apiKey, apiBaseUrl, apiModel) {
  if (!apiKey) {
    return { success: true, content: null, useDefault: true };
  }

  var prompt = "你是一个专业的职业发展顾问。请根据以下简历信息和评分，给出个性化的个人提升建议。\n\n";
  prompt += "## 简历内容\n" + resumeText + "\n\n";
  if (targetJd) prompt += "## 目标岗位\n" + targetJd + "\n\n";
  if (extraInfo) prompt += "## 补充信息\n" + extraInfo + "\n\n";
  prompt += "## 当前各维度评分\n";
  for (var key in scores) {
    prompt += "- " + key + ": " + scores[key] + "分\n";
  }
  prompt += "\n请按以下格式给出建议：\n";
  prompt += "1. 短期行动（本周内可做）：3-5条\n";
  prompt += "2. 中期目标（1-3个月）：2-3条\n";
  prompt += "3. 长期规划（3-6个月）：1-2条\n";
  prompt += "每条建议要具体、可执行，不要笼统。";

  try {
    var client = new OpenAI({
      apiKey: apiKey,
      baseURL: apiBaseUrl || "https://api.deepseek.com"
    });

    var model = apiModel || "deepseek-chat";
    var response = await client.chat.completions.create({
      model: model,
      messages: [{ role: "user", content: prompt }],
      temperature: 0.7,
      max_tokens: 2000
    });

    var content = response.choices[0].message.content;
    return { success: true, content: content, useDefault: false };
  } catch (e) {
    return { success: false, error: "AI 调用失败：" + e.message, useDefault: true };
  }
}

function buildSystemPrompt() {
  return `你是一个专业的简历优化专家。你的任务是根据原始简历和目标岗位，生成优化后的简历。

## 核心原则（按优先级排列）

### P1 - 保真审核（最高优先级）
- 绝对不能修改：时间节点、公司名/学校名、专业名称、职位/岗位名称
- 不能编造经历或夸大事实
- 修改前后的事实信息必须一致
- 对于职位名称，只给出替换建议，不能直接修改

### P2 - 语言质量
- 修正错别字、语法错误
- 确保语句通顺、逻辑自洽
- 时间线合理、前后不矛盾

### P3 - 专业表达
- 使用有力的动词开头（主导/推动/统筹/实施/实现等）
- 使用行业通用术语
- 去掉废话，表达简洁

### P4 - ATS兼容
- 使用标准章节标题（工作经历、教育背景等）
- 适当融入目标岗位的关键词
- 保持格式简单

### P5 - 内容结构
- 时间倒序排列
- 和目标岗位相关的经历放前面

### P6 - 可量化
- 只在确实有数据、有明确结果时才量化
- 如果无法量化，使用准确的定性描述
- 绝对不能编造数据

## 输出格式
请输出优化后的完整简历文本，可以保留基本的排版（用换行和分隔线）。
不要输出任何解释性的文字，只输出简历内容本身。`;
}

function buildUserPrompt(resumeText, targetJd, extraInfo, suggestions) {
  var prompt = "请优化以下简历：\n\n## 原始简历\n" + resumeText + "\n\n";

  if (targetJd && targetJd.trim()) {
    prompt += "## 目标岗位描述\n" + targetJd + "\n\n";
  }

  if (extraInfo && extraInfo.trim()) {
    prompt += "## 补充信息（请整合到简历中）\n" + extraInfo + "\n\n";
  }

  if (suggestions && suggestions.length > 0) {
    prompt += "## 需要参考的优化建议\n";
    suggestions.slice(0, 10).forEach(function(s, i) {
      prompt += (i + 1) + ". " + s.title + "：" + s.suggestion + "\n";
    });
    prompt += "\n";
  }

  return prompt;
}

module.exports = { generateOptimizedResume, generateImprovementPlan };
