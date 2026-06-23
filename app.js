/**
 * 简历优化助手 - 前端逻辑
 */

var state = {
  currentStep: 1,
  resumeText: "",
  resumeFormat: "",
  resumeFileName: "",
  targetJd: "",
  extraInfo: "",
  analysisResult: null,
  optimizedContent: ""
};

var $ = function(id) { return document.getElementById(id); };

function init() {
  loadApiConfig();
  updateApiStatusUI();
  setupFileUpload();
  setupStepNavigation();
  setupPaste();
  setupApiModal();
  setupAnalysis();
  setupGenerate();
  setupDownload();
  setupImprove();
  setupRestart();
}

function loadApiConfig() {
  try {
    var saved = localStorage.getItem("resume_optimizer_api");
    if (saved) {
      var config = JSON.parse(saved);
      $("apiKey").value = config.key || "";
      $("apiBaseUrl").value = config.baseUrl || "https://api.deepseek.com";
      $("apiModel").value = config.model || "deepseek-chat";
    }
  } catch(e) {}
}

function saveApiConfig() {
  var key = $("apiKey").value.trim();
  var baseUrl = $("apiBaseUrl").value.trim();
  var model = $("apiModel").value.trim();
  if (!baseUrl) baseUrl = "https://api.deepseek.com";
  if (!model) model = "deepseek-chat";
  var config = { key: key, baseUrl: baseUrl, model: model };
  localStorage.setItem("resume_optimizer_api", JSON.stringify(config));
  updateApiStatusUI();
}

function clearApiConfig() {
  localStorage.removeItem("resume_optimizer_api");
  $("apiKey").value = "";
  $("apiBaseUrl").value = "https://api.deepseek.com";
  $("apiModel").value = "deepseek-chat";
  updateApiStatusUI();
}

function updateApiStatusUI() {
  var saved = localStorage.getItem("resume_optimizer_api");
  var hasKey = false;
  if (saved) { try { hasKey = JSON.parse(saved).key && JSON.parse(saved).key.length > 0; } catch(e) {} }
  var btn = $("btnApiSettings");
  var statusText = $("apiStatusText");
  if (hasKey) { btn.classList.add("configured"); statusText.textContent = "已配置 ✓"; }
  else { btn.classList.remove("configured"); statusText.textContent = "未配置"; }
}

function getApiConfig() {
  try { return JSON.parse(localStorage.getItem("resume_optimizer_api")); } catch(e) {}
  return { key: "", baseUrl: "https://api.deepseek.com", model: "deepseek-chat" };
}

function hasApiKey() { var cfg = getApiConfig(); return cfg.key && cfg.key.length > 0; }

function setupApiModal() {
  $("btnApiSettings").onclick = function() { loadApiConfig(); $("apiModal").classList.add("active"); };
  $("btnOpenApiFromStep5").onclick = function() { $("apiModal").classList.add("active"); };
  $("btnOpenApiFromStep6").onclick = function() { $("apiModal").classList.add("active"); };
  $("btnCloseModal").onclick = function() { $("apiModal").classList.remove("active"); };
  $("apiModal").onclick = function(e) { if (e.target === this) $("apiModal").classList.remove("active"); };
  $("btnSaveApi").onclick = function() { saveApiConfig(); $("apiModal").classList.remove("active"); };
  $("btnClearApi").onclick = function() { if (confirm("确定清空 API 密钥吗？")) { clearApiConfig(); $("apiModal").classList.remove("active"); } };
}

function setupFileUpload() {
  var uploadArea = $("uploadArea");
  var fileInput = $("fileInput");
  uploadArea.onclick = function() { if (!uploadArea.classList.contains("success")) fileInput.click(); };
  fileInput.onchange = function(e) { if (e.target.files.length > 0) uploadFile(e.target.files[0]); };
  uploadArea.ondragover = function(e) { e.preventDefault(); uploadArea.classList.add("dragover"); };
  uploadArea.ondragleave = function() { uploadArea.classList.remove("dragover"); };
  uploadArea.ondrop = function(e) { e.preventDefault(); uploadArea.classList.remove("dragover"); if (e.dataTransfer.files.length > 0) uploadFile(e.dataTransfer.files[0]); };
}

function uploadFile(file) {
  var formData = new FormData();
  formData.append("resume", file);
  var uploadArea = $("uploadArea");
  var loading = $("loadingUpload");
  var errorEl = $("errorUpload");
  loading.style.display = "block";
  errorEl.style.display = "none";
  fetch("/api/upload", { method: "POST", body: formData })
  .then(function(r) { return r.json(); })
  .then(function(data) {
    loading.style.display = "none";
    if (data.success) {
      state.resumeText = data.content;
      state.resumeFormat = data.format;
      state.resumeFileName = data.file_name;
      uploadArea.classList.add("success");
      uploadArea.querySelector(".upload-text").textContent = "已上传：" + data.file_name;
      uploadArea.querySelector(".upload-hint").textContent = "共 " + data.content.length + " 字";
      $("btnNext1").disabled = false;
    } else {
      errorEl.textContent = data.error;
      errorEl.style.display = "block";
    }
  })
  .catch(function(err) {
    loading.style.display = "none";
    errorEl.textContent = "上传失败：" + err.message;
    errorEl.style.display = "block";
  });
}

function setupPaste() {
  $("btnPaste").onclick = function() {
    var text = $("pasteText").value.trim();
    var errorEl = $("errorUpload");
    errorEl.style.display = "none";
    if (!text) { errorEl.textContent = "请先粘贴简历内容"; errorEl.style.display = "block"; return; }
    state.resumeText = text; state.resumeFormat = "text"; state.resumeFileName = "粘贴文本";
    var uploadArea = $("uploadArea");
    uploadArea.classList.add("success");
    uploadArea.querySelector(".upload-text").textContent = "已使用粘贴的文本";
    uploadArea.querySelector(".upload-hint").textContent = "共 " + text.length + " 字";
    $("btnNext1").disabled = false;
  };
}

function setupStepNavigation() {
  document.onclick = function(e) {
    var t = e.target;
    if (t.id === "btnNext1" && !t.disabled) goToStep(2);
    if (t.id === "btnBack2") goToStep(1);
    if (t.id === "btnNext2") { state.targetJd = $("targetJd").value; goToStep(3); }
    if (t.id === "btnBack3") goToStep(2);
    if (t.id === "btnBack4") goToStep(3);
    if (t.id === "btnBack5") goToStep(4);
    if (t.id === "btnBack6") goToStep(5);
  };
}

function goToStep(step) {
  document.querySelectorAll(".step-panel").forEach(function(p) { p.classList.remove("active"); });
  var tp = $("step" + step); if (tp) tp.classList.add("active");
  document.querySelectorAll(".step-dot").forEach(function(d, i) {
    var n = parseInt(d.dataset.step); d.classList.remove("active","done");
    if (n === step) d.classList.add("active"); else if (n < step) d.classList.add("done");
  });
  document.querySelectorAll(".step-line").forEach(function(l, i) { l.classList.toggle("done", i+1 < step); });
  state.currentStep = step; window.scrollTo(0,0);
}

function setupAnalysis() {
  $("btnAnalyze").onclick = function() {
    state.extraInfo = $("extraInfo").value;
    state.targetJd = $("targetJd").value;
    var loading = $("loadingAnalyze");
    var result = $("analysisResult");
    var errorEl = $("errorAnalyze");
    loading.style.display = "block"; result.style.display = "none"; errorEl.style.display = "none";
    fetch("/api/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ resume_text: state.resumeText, target_jd: state.targetJd, extra_info: state.extraInfo })
    })
    .then(function(r) { return r.json(); })
    .then(function(data) {
      loading.style.display = "none";
      if (data.success) { state.analysisResult = data.result; displayAnalysisResult(data.result); result.style.display = "block"; goToStep(4); }
      else { errorEl.textContent = data.error; errorEl.style.display = "block"; }
    })
    .catch(function(err) { loading.style.display = "none"; errorEl.textContent = "分析失败：" + err.message; errorEl.style.display = "block"; });
  };
}

function displayAnalysisResult(result) {
  $("totalScore").textContent = result.totalScore;
  var container = $("dimensionScores"); container.innerHTML = "";
  var dims = result.dimensionScores;
  for (var name in dims) {
    var dim = dims[name]; var p = dim.score;
    var bc = "low"; if (p >= 70) bc = "high"; else if (p >= 50) bc = "medium";
    var item = document.createElement("div"); item.className = "dimension-item";
    item.innerHTML = "<div class=\"dimension-header\"><span class=\"dimension-name\">" + name + "</span><span class=\"dimension-weight\">权重 " + dim.weight + "%</span></div><div class=\"score-bar\"><div class=\"score-fill " + bc + "\" style=\"width:" + p + "%\"></div></div><div class=\"dimension-score\">" + p + "分</div>";
    container.appendChild(item);
  }
  var list = $("suggestionsList"); list.innerHTML = "";
  var sugs = result.suggestions || [];
  if (sugs.length === 0) { list.innerHTML = "<div class=\"suggestion-item\">暂无优化建议</div>"; return; }
  sugs.forEach(function(s) {
    var item = document.createElement("div"); item.className = "suggestion-item";
    var detailHtml = s.detail ? "<div class=\"suggestion-detail\">" + s.detail + "</div>" : "";
    var fixHtml = s.suggestion ? "<div class=\"suggestion-fix\">\uD83D\uDCA1 " + s.suggestion + "</div>" : "";
    var jdBadge = s.type === "jd_match" ? "<div class=\"suggestion-jd-badge\">\uD83C\uDFAF 关联岗位要求</div>" : "";
    item.innerHTML = "<div class=\"suggestion-priority " + s.priority + "\">" + getPLabel(s.priority) + "</div>" + jdBadge + "<div class=\"suggestion-title\">" + s.title + "</div>" + detailHtml + fixHtml;
    list.appendChild(item);
  });
  var posSection = $("positionSuggestions");
  var posList = $("positionSuggestionsList"); posList.innerHTML = "";
  var posSugs = result.positionSuggestions || [];
  if (posSugs.length > 0) {
    posSection.style.display = "block";
    posSugs.forEach(function(p) {
      var item = document.createElement("div"); item.className = "position-suggestion-item";
      item.innerHTML = "<div class=\"original\">\u5F53\u524D\u5199\u6CD5\uFF1A<strong>" + p.original + "</strong></div><div class=\"suggests\">\u53EF\u8003\u8651\u66FF\u6362\u4E3A\uFF1A" + (p.suggestions||[]).join("\u3001") + "</div><div class=\"suggestion-detail\" style=\"margin-top:4px;font-size:12px;color:#999;\">\u26A0\uFE0F \u8BF7\u81EA\u884C\u786E\u8BA4\u662F\u5426\u4FEE\u6539\uFF0C\u7CFB\u7EDF\u4E0D\u4F1A\u81EA\u52A8\u66F4\u6539</div>";
      posList.appendChild(item);
    });
  } else { posSection.style.display = "none"; }
}

function getPLabel(p) { var labels = { critical: "\u2757 \u91CD\u8981\u63D0\u9192", high: "\u9700\u4FEE\u6539", medium: "\u5EFA\u8BAE\u4F18\u5316", low: "\u9526\u4E0A\u6DFB\u82B1" }; return labels[p] || p; }

function setupGenerate() {
  $("btnGenerate").onclick = function() {
    var loading = $("loadingGenerate");
    var result = $("generateResult");
    var noAi = $("noAiNotice");
    var errorEl = $("errorGenerate");
    var desc = $("step5Desc");
    loading.style.display = "block";
    result.style.display = "none";
    noAi.style.display = "none";
    errorEl.style.display = "none";
    var cfg = getApiConfig();
    fetch("/api/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        resume_text: state.resumeText,
        target_jd: state.targetJd,
        extra_info: state.extraInfo,
        suggestions: state.analysisResult ? state.analysisResult.suggestions : [],
        api_key: cfg.key,
        api_base_url: cfg.baseUrl,
        api_model: cfg.model
      })
    })
    .then(function(r) { return r.json(); })
    .then(function(data) {
      loading.style.display = "none";
      if (data.success) {
        state.optimizedContent = data.content;
        $("optimizedContent").textContent = data.content;
        // 显示修改等级和方式
        var levelText = data.level ? "（" + data.level + "）" : "";
        desc.textContent = "优化后的简历" + levelText;
        result.style.display = "block";
        // 如果有改动对比，展示
        if (data.changes && data.changes.length > 0) {
          var html = "<div class=\"change-summary\"><h4>\u2705 已修改以下内容</h4>";
          data.changes.forEach(function(c) {
            if (c.original) {
              html += "<div class=\"change-item\"><span class=\"change-old\">" + c.original.substring(0,40) + "</span>";
              html += "<span class=\"change-arrow\">\u2192</span>";
              html += "<span class=\"change-new\">" + (c.improved||"").substring(0,40) + "</span></div>";
            }
          });
          html += "</div>";
          // 插到内容前面
          $("optimizedContent").insertAdjacentHTML("beforebegin", html);
        }
        goToStep(5);
      } else {
        showEditableFallback(data.error);
      }
    })
    .catch(function(err) {
      loading.style.display = "none";
      showEditableFallback(err.message);
    });
  };
}

function showEditableFallback(errorMsg, changes) {
  var noAi = $("noAiNotice"); var desc = $("step5Desc");
  var content = state.resumeText;
  var tips = "";
  if (state.analysisResult && state.analysisResult.suggestions.length > 0) {
    tips = "\u3010\u4F18\u5316\u5EFA\u8BAE\u53C2\u8003\u3011\n";
    state.analysisResult.suggestions.forEach(function(s) { if (s.suggestion) tips += "\u2022 " + s.suggestion + "\n"; });
    tips += "\n\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\n\n";
  }
  desc.textContent = errorMsg ? "AI\u8C03\u7528\u5931\u8D25\uFF0C\u4F60\u53EF\u4EE5\u624B\u52A8\u7F16\u8F91\u4EE5\u4E0B\u5185\u5BB9" : "\u4EE5\u4E0B\u662F\u4F60\u7684\u539F\u59CB\u7B80\u5386\uFF0C\u53EF\u4EE5\u76F4\u63A5\u7F16\u8F91\u4FEE\u6539";
  state.optimizedContent = content;
  $("manualContent").textContent = tips + content;
  noAi.style.display = "block";
  if (changes && changes.length > 0) {
    var changeHtml = "<div class=\"change-summary\"><h4>\u2705 已优化以下内容</h4>";
    changes.forEach(function(c) {
      changeHtml += "<div class=\"change-item\"><span class=\"change-old\">✓ " + c.original + "</span><span class=\"change-arrow\">\u2192</span><span class=\"change-new\">" + c.improved + "</span></div>";
    });
    changeHtml += "</div>";
    noAi.innerHTML = changeHtml + noAi.innerHTML;
  }
  goToStep(5);
}

function setupDownload() {
  $("btnCopyText").onclick = function() {
    var content = getCurrentContent();
    navigator.clipboard.writeText(content).then(function() { alert("\u2705 \u5DF2\u590D\u5236\u5230\u526A\u8D34\u677F"); })
    .catch(function() { var ta = document.createElement("textarea"); ta.value = content; document.body.appendChild(ta); ta.select(); document.execCommand("copy"); document.body.removeChild(ta); alert("\u2705 \u5DF2\u590D\u5236"); });
  };
  $("btnDownloadDocx").onclick = function() { downloadFile("docx"); };
  $("btnDownloadPdf").onclick = function() { downloadFile("pdf"); };
}

function getCurrentContent() {
  var mc = $("manualContent"); var oc = $("optimizedContent");
  if (mc && mc.style.display !== "none" && mc.textContent) return mc.textContent;
  if (oc && oc.style.display !== "none" && oc.textContent) return oc.textContent;
  return state.optimizedContent || state.resumeText;
}

function downloadFile(format) {
  var content = getCurrentContent();
  var fn = state.resumeFileName ? state.resumeFileName.replace(/\.[^/.]+$/, "") : "\u4F18\u5316\u7B80\u5386";
  fetch("/api/export", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ content: content, format: format, filename: fn }) })
  .then(function(r) { return r.json(); })
  .then(function(data) { if (data.success) { window.open("/api/download/" + encodeURIComponent(data.file_path.split("\\").pop().split("/").pop()), "_blank"); } else { alert("\u5BFC\u51FA\u5931\u8D25\uFF1A" + data.error); } })
  .catch(function(err) { alert("\u5BFC\u51FA\u5931\u8D25\uFF1A" + err.message); });
}

function setupImprove() {
  $("btnImprove").onclick = function() {
    var loading = $("loadingImprove"); var result = $("improveResult"); var noAi = $("improveNoAi"); var errorEl = $("errorImprove");
    loading.style.display = "block"; result.style.display = "none"; noAi.style.display = "none"; errorEl.style.display = "none";
    if (hasApiKey()) {
      var cfg = getApiConfig();
      fetch("/api/improve-suggestions", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ resume_text: state.resumeText, target_jd: state.targetJd, extra_info: state.extraInfo, scores: state.analysisResult ? state.analysisResult.dimensionScores : {}, api_key: cfg.key, api_base_url: cfg.baseUrl, api_model: cfg.model }) })
      .then(function(r) { return r.json(); })
      .then(function(data) { loading.style.display = "none"; if (data.success && data.content) { $("improveResult").innerHTML = "<div class=\"optimized-content\" style=\"white-space:pre-wrap\">" + data.content + "</div>"; $("improveResult").style.display = "block"; goToStep(6); } else { showDefaultImproves(); } })
      .catch(function() { loading.style.display = "none"; showDefaultImproves(); });
    } else {
      loading.style.display = "none"; showDefaultImproves();
    }
  };
}

function showDefaultImproves() {
  var plan = state.analysisResult ? state.analysisResult.improvementPlan : null;
  if (plan) {
    fillList("shortTermList", plan.shortTerm); fillList("mediumTermList", plan.mediumTerm); fillList("longTermList", plan.longTerm);
    $("improveResult").style.display = "block";
  }
  if (!hasApiKey()) $("improveNoAi").style.display = "block";
  goToStep(6);
}

function fillList(listId, items) {
  var list = $(listId); list.innerHTML = "";
  items.forEach(function(item) { var li = document.createElement("li"); li.textContent = item.text; list.appendChild(li); });
}

function setupRestart() {
  $("btnRestart").onclick = function() {
    if (confirm("\u786E\u5B9A\u8981\u91CD\u65B0\u5F00\u59CB\u5417\uFF1F\u5F53\u524D\u8FDB\u5EA6\u4F1A\u6E05\u7A7A\u3002")) {
      state = { currentStep: 1, resumeText: "", resumeFormat: "", resumeFileName: "", targetJd: "", extraInfo: "", analysisResult: null, optimizedContent: "" };
      var ua = $("uploadArea"); ua.classList.remove("success"); ua.querySelector(".upload-text").textContent = "\u5C06\u7B80\u5386\u6587\u4EF6\u62D6\u5230\u8FD9\u91CC"; ua.querySelector(".upload-hint").textContent = "\u6216\u70B9\u51FB\u6B64\u533A\u57DF\u9009\u62E9\u6587\u4EF6";
      $("btnNext1").disabled = true; $("pasteText").value = ""; $("targetJd").value = ""; $("extraInfo").value = "";
      $("analysisResult").style.display = "none"; $("generateResult").style.display = "none"; $("noAiNotice").style.display = "none";
      $("improveResult").style.display = "none"; $("improveNoAi").style.display = "none";
      goToStep(1);
    }
  };
}

document.addEventListener("DOMContentLoaded", init);