/**
 * 简历解析模块
 * 支持：.docx (Word)、.pdf、纯文本 (.txt)
 */

const path = require("path");
const fs = require("fs");

async function parseResume(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const fileName = path.basename(filePath);

  try {
    let content = "";
    let fmt = "";

    if (ext === ".docx") {
      content = await parseDocx(filePath);
      fmt = "docx";
    } else if (ext === ".pdf") {
      content = await parsePdf(filePath);
      fmt = "pdf";
    } else if (ext === ".txt") {
      content = parseTxt(filePath);
      fmt = "txt";
    } else {
      return {
        success: false,
        content: "",
        format: ext,
        file_name: fileName,
        error: "不支持的文件格式：" + ext + "，请上传 .docx、.pdf 或 .txt 文件"
      };
    }

    if (!content || !content.trim()) {
      return {
        success: false,
        content: "",
        format: fmt,
        file_name: fileName,
        error: "未能从文件中提取到文字内容，请检查文件是否为空或已损坏"
      };
    }

    return {
      success: true,
      content: content.trim(),
      format: fmt,
      file_name: fileName,
      error: null
    };
  } catch (e) {
    return {
      success: false,
      content: "",
      format: ext,
      file_name: fileName,
      error: "读取文件时出错：" + e.message
    };
  }
}

async function parseDocx(filePath) {
  const mammoth = require("mammoth");
  const result = await mammoth.extractRawText({ path: filePath });
  return result.value;
}

async function parsePdf(filePath) {
  const pdfParse = require("pdf-parse");
  const dataBuffer = fs.readFileSync(filePath);
  const data = await pdfParse(dataBuffer);
  return data.text;
}

function parseTxt(filePath) {
  return fs.readFileSync(filePath, "utf-8");
}

module.exports = { parseResume };
