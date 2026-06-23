const express = require("express");
const multer = require("multer");
const cors = require("cors");
const path = require("path");
const fs_extra = require("fs");
const resumeParser = require("./resumeParser");
const evaluationEngine = require("./evaluationEngine");
const exporter = require("./exporter");

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

const uploadDir = path.join(__dirname, "..", "uploads");
if (!fs_extra.existsSync(uploadDir)) {
  fs_extra.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, Date.now() + "_" + Math.random().toString(36).slice(2) + ext);
  }
});

const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    const allowed = [".docx", ".pdf", ".txt"];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.includes(ext)) return cb(null, true);
    cb(new Error("不支持的文件格式，请上传 .docx、.pdf 或 .txt 文件"));
  },
  limits: { fileSize: 5 * 1024 * 1024 }
});

// ==================== API 路由 ====================

app.post("/api/upload", (req, res) => {
  upload.single("resume")(req, res, async (err) => {
    if (err) return res.json({ success: false, error: err.message });
    if (!req.file) return res.json({ success: false, error: "请选择要上传的文件" });
    try {
      const result = await resumeParser.parseResume(req.file.path);
      try { fs_extra.unlinkSync(req.file.path); } catch(e) {}
      res.json(result);
    } catch (e) {
      res.json({ success: false, error: "解析文件时出错：" + e.message });
    }
  });
});

app.post("/api/paste", (req, res) => {
  const { text } = req.body;
  if (!text || !text.trim()) return res.json({ success: false, error: "请粘贴简历内容" });
  res.json({ success: true, content: text.trim(), format: "text", file_name: "粘贴文本" });
});

// 分析简历（不需要 AI，直接使用内置规则）
app.post("/api/analyze", async (req, res) => {
  const { resume_text, target_jd, extra_info } = req.body;
  if (!resume_text || !resume_text.trim()) return res.json({ success: false, error: "缺少简历内容" });
  try {
    const result = evaluationEngine.evaluateResume(resume_text, target_jd || "", extra_info || "");
    res.json({ success: true, result });
  } catch (e) {
    res.json({ success: false, error: "分析时出错：" + e.message });
  }
});

// 生成范文 - 先尝试AI，没有AI则使用规则引擎改写
app.post("/api/generate", async (req, res) => {
  const { resume_text, target_jd, extra_info, suggestions, api_key, api_base_url, api_model } = req.body;
  if (!resume_text || !resume_text.trim()) return res.json({ success: false, error: "缺少简历内容" });

  // 先用规则引擎分析简历
  const evalResult = evaluationEngine.evaluateResume(resume_text, target_jd || "", extra_info || "");

  if (api_key) {
    // 有 AI 密钥：使用 AI + 分析结果的组合提示
    try {
      const aiService = require("./aiService");
      // 使用增强的提示词（包含完整分析结果）
      const aiPrompt = evaluationEngine.buildAIPrompt(resume_text, target_jd || "", extra_info || "", evalResult);
      const result = await aiService.generateOptimizedResume(
        resume_text, target_jd || "", extra_info || "", evalResult.suggestions || [],
        api_key, api_base_url, api_model, aiPrompt
      );
      if (result.success) return res.json(result);
      // AI 失败，降级到规则引擎
    } catch (e) {
      // 静默降级
    }
  }

  // 没有 AI 或 AI 失败：使用自适应规则引擎改写
  try {
    const adapted = evaluationEngine.adaptRewrite(resume_text, target_jd || "", extra_info || "", evalResult);
    const levelLabel = adapted.levelLabel || "小改";
    res.json({
      success: true,
      content: adapted.content,
      method: "rule_" + (adapted.level || "polish"),
      level: levelLabel,
      changes: adapted.changes || [],
      note: "自适应规则引擎优化（" + levelLabel + "）"
    });
  } catch (e) {
    // 改写也失败，返回原文
    res.json({ success: true, content: resume_text, method: "original", note: "返回原始简历" });
  }
});

// 生成提升建议（需要 AI 密钥，从前端传过来）
app.post("/api/improve-suggestions", async (req, res) => {
  const { resume_text, target_jd, extra_info, scores, api_key, api_base_url, api_model } = req.body;
  if (!api_key) return res.json({ success: true, content: null, useDefault: true });

  try {
    const aiService = require("./aiService");
    const result = await aiService.generateImprovementPlan(
      resume_text, target_jd || "", extra_info || "", scores || {},
      api_key, api_base_url, api_model
    );
    res.json(result);
  } catch (e) {
    res.json({ success: false, error: "生成建议时出错：" + e.message });
  }
});

// 导出简历
app.post("/api/export", async (req, res) => {
  const { content, format, filename } = req.body;
  if (!content) return res.json({ success: false, error: "缺少导出的内容" });
  try {
    const outputPath = await exporter.exportResume(content, format || "txt", filename || "优化简历");
    res.json({ success: true, file_path: outputPath });
  } catch (e) {
    res.json({ success: false, error: "导出时出错：" + e.message });
  }
});

app.get("/api/download/:filename", (req, res) => {
  const filepath = path.join(uploadDir, req.params.filename);
  if (!fs_extra.existsSync(filepath)) return res.status(404).json({ error: "文件不存在" });
  res.download(filepath);
});

// 前端静态文件
app.use(express.static(path.join(__dirname, "..", "frontend")));

app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "..", "frontend", "index.html"));
});

app.listen(PORT, () => {
  console.log("简历优化助手已启动：http://localhost:" + PORT);
});
