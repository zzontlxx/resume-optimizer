/**
 * 导出模块
 * 支持导出为：Word (.docx)、PDF、纯文本 (.txt)
 */

const fs = require("fs");
const path = require("path");

const uploadDir = path.join(__dirname, "..", "uploads");

/**
 * 导出简历
 * @param {string} content - 文本内容
 * @param {string} format - 导出格式：docx / pdf / txt
 * @param {string} filename - 文件名（不含扩展名）
 * @returns {string} 导出文件的保存路径
 */
async function exportResume(content, format, filename) {
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
  }

  var safeFilename = filename.replace(/[<>:"/\\|?*]/g, "_");
  var outputPath;

  if (format === "docx") {
    outputPath = await exportDocx(content, safeFilename);
  } else if (format === "pdf") {
    outputPath = await exportPdf(content, safeFilename);
  } else {
    // 默认导出为 txt
    outputPath = path.join(uploadDir, safeFilename + ".txt");
    fs.writeFileSync(outputPath, content, "utf-8");
  }

  return outputPath;
}

/**
 * 导出为 Word (.docx)
 */
async function exportDocx(content, filename) {
  const docx = require("docx");
  const { Document, Packer, Paragraph, TextRun, HeadingLevel } = docx;

  var lines = content.split("\n");
  var paragraphs = [];

  lines.forEach(function(line) {
    var text = line.trim();
    if (!text) {
      paragraphs.push(new Paragraph({ spacing: { after: 100 } }));
      return;
    }

    // 检测是否像标题（简短的行）
    if (text.length < 20 && !text.endsWith("。") && !text.endsWith("：")) {
      paragraphs.push(
        new Paragraph({
          children: [new TextRun({ text: text, bold: true, size: 24, font: "微软雅黑" })],
          spacing: { before: 200, after: 100 }
        })
      );
    } else {
      paragraphs.push(
        new Paragraph({
          children: [new TextRun({ text: text, size: 22, font: "微软雅黑" })],
          spacing: { after: 80 }
        })
      );
    }
  });

  var doc = new Document({
    sections: [{
      properties: { page: { margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 } } },
      children: paragraphs
    }]
  });

  var outputPath = path.join(uploadDir, filename + ".docx");
  var buffer = await Packer.toBuffer(doc);
  fs.writeFileSync(outputPath, buffer);

  return outputPath;
}

/**
 * 导出为 PDF
 * 使用简单方式：将文本写入 PDF 文件
 * 注意：完整排版的 PDF 需要更多处理，此处为初始版本
 */
async function exportPdf(content, filename) {
  // 简单版本：将文本内容包装为简单的 PDF
  var lines = content.split("\n");
  var pdfContent = [];
  
  pdfContent.push("%PDF-1.4");
  
  // 简单实现 - 写入文本内容
  // 实际项目推荐使用 pdfkit 或 puppeteer 生成更精美的 PDF
  var outputPath = path.join(uploadDir, filename + ".pdf");
  
  // 使用纯文本转换为简单 PDF
  var textContent = content.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
  var simplifiedPdf = generateSimplePdf(textContent);
  fs.writeFileSync(outputPath, simplifiedPdf);
  
  return outputPath;
}

/**
 * 生成简单的 PDF（纯文本格式，适合内容展示）
 * 更精美的 PDF 后续可以用 puppeteer 生成
 */
function generateSimplePdf(text) {
  var lines = text.split("\n");
  var objects = [];
  var offsets = [];
  var currentOffset = 0;
  
  // 对象1: 目录
  objects.push("1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj");
  offsets.push(currentOffset);
  currentOffset += objects[0].length + 1;
  
  // 对象2: 页面
  objects.push("2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj");
  offsets.push(currentOffset);
  currentOffset += objects[1].length + 1;
  
  // 对象3: 页面内容
  var textObj = "";
  textObj += "3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>\nendobj";
  objects.push(textObj);
  offsets.push(currentOffset);
  currentOffset += objects[2].length + 1;
  
  // 对象4: 内容流
  var streamContent = "BT\n/F1 12 Tf\n50 750 Td\n";
  var y = 750;
  
  lines.forEach(function(line) {
    if (line.trim()) {
      var safeLine = line.substring(0, 80); // 限制每行长度
      streamContent += "/F1 12 Tf\n(" + safeLine.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)") + ") Tj\n0 -18 Td\n";
      y -= 18;
    } else {
      streamContent += "0 -18 Td\n";
      y -= 18;
    }
  });
  
  streamContent += "ET";
  
  var streamObj = "4 0 obj\n<< /Length " + streamContent.length + " >>\nstream\n" + streamContent + "\nendstream\nendobj";
  objects.push(streamObj);
  offsets.push(currentOffset);
  currentOffset += objects[3].length + 1;
  
  // 对象5: 字体
  var fontObj = "5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj";
  objects.push(fontObj);
  offsets.push(currentOffset);
  currentOffset += objects[4].length + 1;
  
  // 构建交叉引用表
  var xrefOffset = currentOffset;
  var xref = "xref\n0 " + (objects.length + 1) + "\n0000000000 65535 f \n";
  offsets.forEach(function(offset) {
    xref += ("0000000000" + offset).slice(-10) + " 00000 n \n";
  });
  
  // 文件头
  var pdf = "%PDF-1.4\n";
  objects.forEach(function(obj) {
    pdf += obj + "\n";
  });
  pdf += xref;
  pdf += "trailer\n<< /Size " + (objects.length + 1) + " /Root 1 0 R >>\nstartxref\n" + xrefOffset + "\n%%EOF";
  
  return pdf;
}

/**
 * 导出为纯文本
 */
async function exportText(content, filename) {
  var outputPath = path.join(uploadDir, filename + ".txt");
  fs.writeFileSync(outputPath, content, "utf-8");
  return outputPath;
}

module.exports = { exportResume };
