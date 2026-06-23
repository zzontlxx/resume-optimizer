
/**
 * 简历优化引擎 v2 - 结构化评估引擎
 *
 * P1 专业表达  - 权重 20%
 * P2 ATS兼容   - 权重 20%（清晰为主）
 * P3 内容结构  - 权重 15%
 * P4 可量化    - 权重 15%
 * P5 语言质量  - 权重 10%
 * P6 岗位匹配  - 权重 20%（针对目标岗位优化）
 */

// ===== 简历解析器 =====
function parseResume(text) {
  var result = {
    personalInfo: { raw: "", name: "", phone: "", email: "" },
    sections: [],
    rawText: text
  };
  var lines = text.split("\n");
  var currentSection = null;
  var sectionLines = [];

  var sectionKeywords = [
    { name: "个人信息", keywords: ["个人信息","联系方式","基本资料","个人资料"] },
    { name: "工作经历", keywords: ["工作经历","工作经验","工作履历","从业经历","实习经历"] },
    { name: "教育背景", keywords: ["教育背景","教育经历"] },
    { name: "专业技能", keywords: ["专业技能","技能专长","技术能力"] },
    { name: "项目经验", keywords: ["项目经验","项目经历"] },
    { name: "自我评价", keywords: ["自我评价","自我评估","个人评价","关于我"] },
    { name: "证书", keywords: ["证书","资质","资格认证","荣誉"] }
  ];

  function isSectionHeader(line) {
    var t = line.trim();
    // 章节标题特征：较短（<=15字），且以关键词开头
    if (t.length > 15 || t.length === 0) return false;
    for (var i = 0; i < sectionKeywords.length; i++) {
      for (var j = 0; j < sectionKeywords[i].keywords.length; j++) {
        var kw = sectionKeywords[i].keywords[j];
        // 关键行必须以此关键词开头（或包含但没有其他内容）
        if (t.indexOf(kw) === 0) return sectionKeywords[i].name;
      }
    }
    return false;
  }

  for (var i = 0; i < lines.length; i++) {
    var sn = isSectionHeader(lines[i]);
    if (sn) {
      if (currentSection && sectionLines.length > 0) {
        result.sections.push({ name: currentSection, lines: sectionLines.slice(), text: sectionLines.join("\n") });
      }
      currentSection = sn;
      sectionLines = [];
    } else if (currentSection) {
      sectionLines.push(lines[i]);
    } else {
      result.personalInfo.raw += lines[i] + "\n";
    }
  }
  if (currentSection && sectionLines.length > 0) {
    result.sections.push({ name: currentSection, lines: sectionLines.slice(), text: sectionLines.join("\n") });
  }

  // 提取个人信息
  var t = result.personalInfo.raw;
  var nm = t.match(/^([\u4e00-\u9fa5]{2,4})/);
  if (nm) result.personalInfo.name = nm[1];
  var ph = t.match(/(1[3-9]\d{9})/);
  if (ph) result.personalInfo.phone = ph[1];
  var em = t.match(/(?:^|[\s])?([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z]{2,4})/); if(em&&em[1]) result.personalInfo.email = em[1];
  if (em) result.personalInfo.email = em[1];

  // 全文搜索
  if (!result.personalInfo.name) { var n2 = text.match(/^([\u4e00-\u9fa5]{2,4})/m); if (n2) result.personalInfo.name = n2[1]; }
  if (!result.personalInfo.phone) { var p2 = text.match(/(1[3-9]\d{9})/); if (p2) result.personalInfo.phone = p2[1]; }
  if (!result.personalInfo.email) { var e2 = text.match(/(?:^|[\s])?([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z]{2,4})/); if (e2 && e2[1]) result.personalInfo.email = e2[1]; }

  return result;
}

function makeSuggestion(type, priority, title, detail, fix, extra) {
  var s = { type: type, priority: priority, title: title, detail: detail || "", suggestion: fix || "", original: "", improved: "" };
  if (extra) {
    if (extra.original) s.original = extra.original;
    if (extra.improved) s.improved = extra.improved;
    if (extra.keywords) s.keywords = extra.keywords;
  }
  return s;
}


// ============================================================
// 岗位描述（JD）深度解析器
// ============================================================

var JD_SECTION_PATTERNS = {
  responsibilities: ["岗位职责","职位描述","工作内容","你需要做","你的工作","工作职责","职责描述"],
  requirements: ["任职要求","任职资格","岗位要求","我们希望你","你需要具备","职位要求","资格要求"],
  plus: ["优先","加分","具备以下","有相关经验者","有以下经验者"],
  softSkills: ["沟通","协作","团队","抗压","主动","自驱","责任心","学习能力","问题解决"]
};

function parseJD(text) {
  if (!text || !text.trim()) return null;

  var result = {
    raw: text,
    responsibilities: [],    // 岗位职责点
    requirements: [],        // 硬性要求
    preferred: [],           // 加分项
    skills: {
      technical: [],         // 技术技能
      soft: [],              // 软技能
      domain: []             // 行业/领域知识
    },
    experience: {            // 经验要求
      years: null,
      domainText: ""
    },
    sections: {}             // 按章节分组的内容
  };

  // 1. 按章节分解
  var lines = text.split("\n");
  var currentSection = "unknown";
  var sectionContent = {};

  for (var i = 0; i < lines.length; i++) {
    var line = lines[i].trim();
    if (!line) continue;

    var matched = false;
    for (var section in JD_SECTION_PATTERNS) {
      var keywords = JD_SECTION_PATTERNS[section];
      for (var j = 0; j < keywords.length; j++) {
        if (line.indexOf(keywords[j]) !== -1 && line.length < 30) {
          currentSection = section;
          matched = true;
          break;
        }
      }
      if (matched) break;
    }

    if (!matched) {
      if (!sectionContent[currentSection]) sectionContent[currentSection] = [];
      sectionContent[currentSection].push(line);
    }
  }

  result.sections = sectionContent;

  // 2. 提取职责点
  var respLines = (sectionContent["responsibilities"] || []).concat(sectionContent["unknown"] || []);
  for (var i = 0; i < respLines.length; i++) {
    var line = respLines[i];
    // 分割要点
    var points = line.split(/[；;。.！!]/);
    for (var j = 0; j < points.length; j++) {
      var p = points[j].trim();
      if (p.length > 5 && /[，,]/.test(p)) {
        result.responsibilities.push(p);
      }
    }
  }

  // 3. 提取技术关键词
  var techStr = (respLines.join(" ") + (sectionContent["requirements"] || []).join(" "));
  // 常见技术词汇
  var techWords = techStr.match(/[A-Za-z0-9+#.]+/g) || [];
  var commonTechs = [];
  var skipWords = ["to","the","and","for","of","in","on","with","at","by","is","are","be","has","have","do","does","did","will","can","may","must","should","would","could","this","that","these","those","from","as","or","an","if","not","no","etc","e","g","i","etc."];

  for (var i = 0; i < techWords.length; i++) {
    var w = techWords[i].trim();
    if (w.length >= 2 && skipWords.indexOf(w.toLowerCase()) === -1 && commonTechs.indexOf(w) === -1) {
      // 检查是否包含数字或大写字母（通常是技术词汇的特征）
      if (/[A-Z0-9+#]/.test(w) || w.length > 3) {
        commonTechs.push(w);
      }
    }
  }
  result.skills.technical = commonTechs.slice(0, 20);

  // 4. 提取软技能
  var allText = text;
  for (var i = 0; i < JD_SECTION_PATTERNS.softSkills.length; i++) {
    var ss = JD_SECTION_PATTERNS.softSkills[i];
    if (allText.indexOf(ss) !== -1 && result.skills.soft.indexOf(ss) === -1) {
      result.skills.soft.push(ss);
    }
  }

  // 5. 提取经验年限
  var yearMatch = text.match(/(\d+)[\-\~到至]+(\d+).*年/);
  if (!yearMatch) yearMatch = text.match(/(\d+)\s*年[\-\~以][上]?[\s\S]{0,5}(?:经验|工作)/);
  if (!yearMatch) yearMatch = text.match(/(\d+)\s*年[\-\~以][上]?经验/);
  if (yearMatch) {
    result.experience.years = parseInt(yearMatch[1]);
  }

  return result;
}

// ============================================================
// JD驱动的深度匹配分析
// ============================================================

function checkJDMatch(structured, rawText, parsedJD) {
  var sgs = [];
  if (!parsedJD) return { suggestions: sgs };

  // 1. 职责匹配分析
  var workText = "";
  for (var i = 0; i < structured.sections.length; i++) {
    var s = structured.sections[i];
    if (s.name === "工作经历" || s.name === "项目经验") {
      workText += s.text + " ";
    }
  }

  // 把职责点与简历对比
  var matchedResp = [];
  var unmatchedResp = [];

  for (var i = 0; i < parsedJD.responsibilities.length; i++) {
    var resp = parsedJD.responsibilities[i];
    var found = false;
    // 提取这个职责中的关键词
    var respWords = resp.split(/[，,、\s]+/);
    var matchCount = 0;
    for (var j = 0; j < respWords.length; j++) {
      var w = respWords[j].trim();
      if (w.length > 2 && workText.indexOf(w) !== -1) matchCount++;
    }
    if (matchCount >= 2) {
      matchedResp.push({ text: resp, matchCount: matchCount });
    } else if (matchCount === 0 && resp.length > 8) {
      unmatchedResp.push(resp);
    }
  }

  if (unmatchedResp.length > 0) {
    // 只显示最重要的 3 条
    var topUnmatched = unmatchedResp.slice(0, 3);
    for (var i = 0; i < topUnmatched.length; i++) {
      sgs.push(makeSuggestion("jd_match", "high",
        "岗位职责：简历中未体现" + topUnmatched[i].substring(0, 40) + "...",
        "岗位要求做这件事：" + topUnmatched[i],
        "如果做过类似工作，请补充到简历中。如果没做过，可以思考是否有可迁移的经验。"
      ));
    }
  }

  // 2. 技术技能匹配
  if (parsedJD.skills.technical.length > 0) {
    var techFound = [];
    var techMissing = [];
    for (var i = 0; i < parsedJD.skills.technical.length; i++) {
      var tech = parsedJD.skills.technical[i];
      if (rawText.indexOf(tech) !== -1) {
        techFound.push(tech);
      } else if (tech.length > 2) {
        techMissing.push(tech);
      }
    }

    if (techMissing.length > 0) {
      sgs.push(makeSuggestion("jd_match", "high",
        "技能差距：岗位要求的以下技能简历未体现",
        "岗位明确要求：" + techMissing.join("、"),
        "如果掌握这些技能，请补充到专业技能部分。如果不会，建议学习基础概念以便面试时能聊。",
        { keywords: techMissing }
      ));
    }

    if (techFound.length > 0) {
      sgs.push(makeSuggestion("jd_match", "medium",
        "技能匹配良好：检测到" + techFound.join("、"),
        "简历中体现了这些岗位所需技能",
        "建议在描述工作经历时具体说明这些技能的应用场景，而不是只列出来。"
      ));
    }
  }

  // 3. 经验年限对比
  if (parsedJD.experience.years) {
    var resumeYears = rawText.match(/\d{4}/g) || [];
    var yearCount = [];
    if (resumeYears.length >= 2) {
      var sorted = resumeYears.map(function(y){return parseInt(y);}).sort(function(a,b){return a-b;});
      var span = sorted[sorted.length-1] - sorted[0];
      var estimatedYears = Math.min(Math.ceil(span / 2), span);

      var jdYear = parsedJD.experience.years;
      if (estimatedYears < jdYear - 1) {
        sgs.push(makeSuggestion("jd_match", "medium",
          "经验年限差距：岗位要求" + jdYear + "年经验，简历显示约" + estimatedYears + "年",
          "岗位要求" + jdYear + "年以上经验",
          "如果简历中未完整展示所有经历，请补充。如果确实年限不足，可以强调项目质量和个人能力。"
        ));
      }
    }
  }

  // 4. 软技能匹配
  if (parsedJD.skills.soft.length > 0) {
    var softFound = [];
    for (var i = 0; i < parsedJD.skills.soft.length; i++) {
      var ss = parsedJD.skills.soft[i];
      if (rawText.indexOf(ss) !== -1) softFound.push(ss);
    }
    if (softFound.length > 0) {
      sgs.push(makeSuggestion("jd_match", "low",
        "软技能体现良好：检测到" + softFound.join("、"),
        "岗位看重的软技能在简历中有所体现",
        "建议在自我评价或工作描述中具体举例说明这些软技能。"
      ));
    }
  }

  // 5. 职位方向审核
  var workLines = [];
  for (var i = 0; i < structured.sections.length; i++) {
    if (structured.sections[i].name === "工作经历") {
      workLines = structured.sections[i].lines;
      break;
    }
  }

  if (workLines.length > 0 && parsedJD.responsibilities.length > 0) {
    // 检查第一个工作经历的第一行(通常是公司+职位)
    var firstWorkLine = workLines[0] || "";
    var jdFirstLine = parsedJD.raw.split("\n")[0] || "";
    // 检查是否有职位名称匹配
    var commonTitles = ["开发","工程","运营","产品","设计","测试","运维","数据分析","架构","算法","前端","后端","全栈","Java","Python","Go","Node","React","Vue"];
    var jdTitleWords = [];
    for (var i = 0; i < commonTitles.length; i++) {
      if (jdFirstLine.indexOf(commonTitles[i]) !== -1) jdTitleWords.push(commonTitles[i]);
    }
    var resumeTitleMatch = false;
    for (var i = 0; i < jdTitleWords.length; i++) {
      if (firstWorkLine.indexOf(jdTitleWords[i]) !== -1) resumeTitleMatch = true;
    }

    if (jdTitleWords.length > 0 && !resumeTitleMatch) {
      sgs.push(makeSuggestion("jd_match", "medium",
        "职位方向提示：你申请的" + jdTitleWords.join("/") + "岗位",
        "检测到你的工作经历中没有明确体现" + jdTitleWords.join("/") + "方向的描述",
        '如果之前从事的就是相关方向，建议在工作经历开头明确标注，例如：XX公司 - ' + jdTitleWords[0] + '工程师。'
      ));
    }
  }

  return { suggestions: sgs };
}

// ============================================================
// JD驱动的提升建议
// ============================================================

function genJDImprovePlan(dimScores, parsedJD) {
  var s = [], m = [], l = [];

  if (!parsedJD) return { shortTerm: s, mediumTerm: m, longTerm: l };

  // 技术技能短期建议
  if (parsedJD.skills.technical.length > 0) {
    s.push({ done: false, text: "针对岗位所需的" + parsedJD.skills.technical.slice(0,3).join("/") + "等技能，在简历中突出你使用这些技能的具体场景" });
  }

  // 中期：弥补技能差距
  var missingTech = []; // We don't have this info here, use a generic approach
  if (parsedJD.skills.technical.length > 0) {
    m.push({ done: false, text: "了解岗位要求的" + parsedJD.skills.technical.slice(0,3).join("/") + "等技能，如不熟悉建议先学习基础知识" });
  }

  // 根据岗位方向通用建议
  if (parsedJD.skills.techFirst) {
    m.push({ done: false, text: "完善个人技术博客或GitHub，展示你的代码能力和项目经验" });
  }

  // 经验年限
  if (parsedJD.experience.years) {
    m.push({ done: false, text: "收集过往项目中与" + parsedJD.experience.years + "年经验匹配的数据和成果，为面试做准备" });
  }

  return { shortTerm: s, mediumTerm: m, longTerm: l };
}



// ===== P1：保真审核 =====
function checkP1(structured, rawText) {
  var score = 100, sgs = [];
  var info = structured.personalInfo;

  if (!info.name || info.name.length < 2) {
    score -= 10;
    sgs.push(makeSuggestion("authenticity","high","未检测到姓名","简历开头没有找到姓名","在简历最上方写上你的姓名"));
  }

  if (info.phone) {
    var c = info.phone.replace(/[-\s]/g, "");
    if (c.length !== 11) {
      score -= 8;
      sgs.push(makeSuggestion("authenticity","high","手机号格式不正确","检测到" + info.phone + "，" + c.length + "位，应为11位","请检查是否漏写了数字"));
    } else if (!/^1[3-9]/.test(c)) {
      score -= 5;
      sgs.push(makeSuggestion("authenticity","medium","手机号开头异常","以" + c.substring(0,2) + "开头，通常以13/14/15/17/18/19开头","请确认手机号"));
    }
  } else {
    score -= 10;
    sgs.push(makeSuggestion("authenticity","high","未检测到手机号","简历中没有手机号","请补上手机号码"));
  }

  if (info.email) {
    if (info.email.indexOf("@") === -1 || info.email.indexOf(".") === -1) {
      score -= 5;
      sgs.push(makeSuggestion("authenticity","medium","邮箱格式不正确","检测到" + info.email + "，格式有问题","请检查邮箱地址"));
    }
  } else {
    score -= 8;
    sgs.push(makeSuggestion("authenticity","high","未检测到邮箱","简历中没有找到邮箱","请补上邮箱地址"));
  }

  // 时间线
  var years = []; var ym = rawText.match(/\d{4}/g); if(ym){for(var yi=0;yi<ym.length;yi++){var yn=parseInt(ym[yi]);if(yn>1980&&yn<2050)years.push(ym[yi]);}}
  if (years.length > 0) {
    var cy = new Date().getFullYear(), bad = false;
    for (var i = 0; i < years.length; i++) {
      var y = parseInt(years[i]);
      if (y > cy) {
        bad = true; score -= 10;
        sgs.push(makeSuggestion("authenticity","critical","存在未来年份：" + y,"当前是" + cy + "年","请确认时间是否正确"));
        break;
      }
    }
    if (!bad && years.filter(function(y){var n=parseInt(y);return n>1990&&n<2030;}).length===0) {
      score -= 5;
      sgs.push(makeSuggestion("authenticity","medium","年份异常","提取到的年份：" + years.join(","),"请确认时间信息"));
    }
  } else {
    score -= 10;
    sgs.push(makeSuggestion("authenticity","high","未检测到时间","简历中没有任何年份","请为每段经历添加时间范围"));
  }

  score = Math.max(score, 0);
  return { score: score, suggestions: sgs };
}



// ===== 动词库 =====
var ACTION_VERBS = {
  strong: ["主导","推动","搭建","创立","构建","制定","实现","完成","统筹","率领","带领","驱动","促成","达成","交付","落地","优化","重构","升级","改进","提升","降低","缩短","减少","设计","开发","研发","创建","部署","上线","发布"],
  medium: ["负责","管理","执行","实施","处理","协调","组织","参与","协助","配合","跟进","支持","维护","运营","分析","撰写"],
  weak: ["做","弄","搞","干","整","接触","了解","知道","懂得","看过","听过","用过","学过"]
};

// ===== P2：专业表达 =====
function checkP2(structured, rawText, targetJd) {
  var score = 100, sgs = [];

  // 找到工作经历
  var ws = null;
  for (var i = 0; i < structured.sections.length; i++) {
    if (structured.sections[i].name === "工作经历" || structured.sections[i].name === "项目经验") { ws = structured.sections[i]; break; }
  }
  if (!ws) {
    score -= 20;
    sgs.push(makeSuggestion("professional","high","未检测到工作/项目经历","简历中没有找到工作经历或项目经验章节","请添加工作经历或项目经验"));
    return { score: Math.max(score,0), suggestions: sgs };
  }

  // 提取要点
  var bps = [], cur = "";
  for (var i = 0; i < ws.lines.length; i++) {
    var l = ws.lines[i].trim();
    if (!l) continue;
    if (/^[-\u00b7\u2022]\s/.test(l) || /^\d+[\.\u3001]/.test(l)) { if (cur) bps.push(cur); cur = l; }
    else if (cur) cur += " " + l;
    else cur = l;
  }
  if (cur) bps.push(cur);

  // 动词检查
  var weakCount = 0, strongCount = 0;
  for (var i = 0; i < bps.length; i++) {
    var p = bps[i], found = false;
    for (var j = 0; j < ACTION_VERBS.strong.length; j++) {
      if (p.indexOf(ACTION_VERBS.strong[j]) <= 3) { strongCount++; found = true; break; }
    }
    if (!found) {
      for (var j = 0; j < ACTION_VERBS.weak.length; j++) {
        if (p.indexOf(ACTION_VERBS.weak[j]) <= 3) {
          weakCount++;
          score -= 8;
          sgs.push(makeSuggestion("professional","high","开头动词较弱：\"" + ACTION_VERBS.weak[j] + "\"","在\"" + p.substring(0,40) + "...\"中","建议替换为：完成/实现/主导/搭建/推动", { original: p.substring(0,60) }));
          found = true;
          break;
        }
      }
    }
    // 检查"我"字开头
    if (!found && /^我\s*/.test(p)) {
      score -= 5;
      sgs.push(makeSuggestion("professional","medium","\"我\"字开头可优化","\"" + p.substring(0,30) + "...\"以\"我\"开头","直接以动词开头", { original: p.substring(0,50) }));
    }
  }

  // 行业术语
  if (targetJd && targetJd.trim()) {
    var jdWords = targetJd.split(/[\s,\u3001\u3002\uff1b\uff1a\/]/);
    var missed = [];
    for (var i = 0; i < jdWords.length; i++) {
      var w = jdWords[i].trim();
      if (w.length > 2 && rawText.indexOf(w) === -1) missed.push(w);
    }
    if (missed.length > 3) {
      score -= Math.min(missed.length * 2, 15);
      sgs.push(makeSuggestion("professional","medium","目标岗位关键词缺失","岗位描述中的以下关键词简历未体现",missed.slice(0,5).join("、"), { keywords: missed.slice(0,5) }));
    }
  }

  // 啰嗦表达
  var vbs = rawText.match(/负责[^，。]*的工作/g);
  if (vbs) {
    score -= vbs.length * 5;
    sgs.push(makeSuggestion("professional","medium","啰嗦表达：\"负责……的工作\"","有" + vbs.length + "处","直接说做了什么，如\"维护XX系统\""));
  }

  // 职责 vs 成果
  var hasResp = /负责|参与|协助|配合/.test(rawText);
  var hasAch = /提升了|降低了|缩短了|实现了|完成了|上线|发布|交付/.test(rawText);
  if (hasResp && !hasAch) {
    score -= 10;
    sgs.push(makeSuggestion("professional","medium","偏重职责描述，缺少成果","主要在说\"做了什么\"，缺少\"做到了什么\"","补充成果：\"维护XX系统，保障99.9%可用率\""));
  }

  return { score: Math.max(score,0), suggestions: sgs };
}

// ===== P3：ATS兼容 =====
function checkP3(structured, rawText, targetJd) {
  var score = 100, sgs = [];

  // 标准章节
  var required = ["工作经历","教育背景","专业技能"];
  var found = structured.sections.map(function(s){return s.name;});
  var missing = required.filter(function(s){return found.indexOf(s) === -1;});
  if (missing.length > 0) {
    score -= missing.length * 8;
    sgs.push(makeSuggestion("ats","high","缺少关键章节", "缺少：" + missing.join("、"), "建议补充（有相关内容的话）"));
  }

  // 格式一致性
  var bls = rawText.split("\n").filter(function(l){return l.trim();});
  var styles = [];
  for (var i = 0; i < bls.length; i++) {
    var fc = bls[i].trim().charAt(0);
    if ("-\u00b7\u2022*".indexOf(fc) !== -1 && styles.indexOf(fc) === -1) styles.push(fc);
  }
  if (styles.length > 2) {
    score -= 5;
    sgs.push(makeSuggestion("ats","low","项目符号不统一","混用了" + styles.join("、"),"建议统一使用同一种（推荐 - ）"));
  }

  // 长段落
  var ws = null;
  for (var i = 0; i < structured.sections.length; i++) {
    if (structured.sections[i].name === "工作经历") { ws = structured.sections[i]; break; }
  }
  if (ws) {
    var lens = [], cur = 0;
    for (var i = 0; i < ws.lines.length; i++) {
      var l = ws.lines[i].trim();
      if (!l) { if (cur > 0) { lens.push(cur); cur = 0; } }
      else cur += l.length;
    }
    if (cur > 0) lens.push(cur);
    var long = lens.filter(function(l){return l > 200;});
    if (long.length > 0) {
      score -= 5;
      sgs.push(makeSuggestion("ats","medium","存在过长段落",long.length + "段超过200字","拆分为3-5个要点，每个不超过50字"));
    }
  }

  // 关键词匹配
  if (targetJd && targetJd.trim()) {
    var jdKws = extractKeywords(targetJd);
    var rKws = extractKeywords(rawText);
    var matched = 0;
    for (var i = 0; i < jdKws.length; i++) {
      if (jdKws[i].length > 1 && rKws.indexOf(jdKws[i]) !== -1) matched++;
    }
    var rate = jdKws.length > 0 ? (matched / jdKws.length * 100) : 0;
    if (rate < 30) {
      score -= 15;
      sgs.push(makeSuggestion("ats","high","关键词匹配度低(" + Math.round(rate) + "%)","覆盖" + matched + "/" + jdKws.length + "个","补充岗位要求的技能关键词"));
    } else if (rate < 60) {
      score -= 8;
      sgs.push(makeSuggestion("ats","medium","关键词匹配度一般(" + Math.round(rate) + "%)","覆盖" + matched + "/" + jdKws.length + "个","检查是否有遗漏的重要技能"));
    }
  }

  return { score: Math.max(score,0), suggestions: sgs };
}

// ===== P4：内容结构 =====
function checkP4(structured, rawText) {
  var score = 100, sgs = [];

  // 时间倒序检查
  var years = rawText.match(/\d{4}/g) || [];
  var uy = [];
  for (var i = 0; i < years.length; i++) {
    var n = parseInt(years[i]);
    if (uy.indexOf(years[i]) === -1 && n > 2000 && n < 2030) uy.push(years[i]);
  }
  uy.sort();
  if (uy.length >= 2) {
    var latest = uy[uy.length - 1];
    var ws = null;
    for (var i = 0; i < structured.sections.length; i++) {
      if (structured.sections[i].name === "工作经历") { ws = structured.sections[i]; break; }
    }
    if (ws) {
      var firstLines = ws.lines.slice(0, 3).join(" ");
      if (firstLines.indexOf(latest) === -1) {
        score -= 5;
        sgs.push(makeSuggestion("structure","low","建议最新经历放最前面","简历通常时间倒序","调整工作经历顺序"));
      }
    }
  }

  // 章节内容完整性
  for (var i = 0; i < structured.sections.length; i++) {
    var sec = structured.sections[i];
    var cl = sec.lines.filter(function(l){return l.trim();});
    if (cl.length === 0) {
      score -= 10;
      sgs.push(makeSuggestion("structure","high",sec.name + "章节为空","有标题但没有内容","请补全或删除"));
    }
  }

  return { score: Math.max(score,0), suggestions: sgs };
}

// ===== P5：可量化 =====
function checkP5(rawText) {
  var score = 60, sgs = [];

  var patterns = [
    { re: /\d+%/g, label: "百分比" },
    { re: /\d+倍/g, label: "倍数" },
    { re: /\d+[多余]人/g, label: "人数" },
    { re: /\d+[万多]?[元块]/g, label: "金额" },
    { re: /\d+[家个]项目/g, label: "项目数" },
    { re: /\d+次/g, label: "次数" }
  ];

  var found = [];
  for (var i = 0; i < patterns.length; i++) {
    var m = rawText.match(patterns[i].re);
    if (m) { found = found.concat(m); score += 8; }
  }
  score = Math.min(score, 100);

  if (found.length === 0) {
    score = 40;
    sgs.push(makeSuggestion("quantifiable","high","缺少量化成果","整份简历没有具体数字","回顾工作，尝试补充数据。没有确切数据不要编造"));
  } else if (found.length < 3) {
    sgs.push(makeSuggestion("quantifiable","medium","量化成果较少","找到" + found.length + "处：" + found.join(","),"如有更多数据建议补充"));
  }

  // 模糊词
  var vague = ["显著","明显","大幅","巨大","非常好","很多","大量"];
  for (var i = 0; i < vague.length; i++) {
    if (rawText.indexOf(vague[i]) !== -1) {
      score -= 5;
      sgs.push(makeSuggestion("quantifiable","medium","模糊词\"" + vague[i] + "\"","主观评价，无法准确判断","有数据用数字替代，否则用更准确的定性描述"));
      break;
    }
  }

  return { score: Math.max(score,0), suggestions: sgs };
}

// ===== P6：语言质量 =====
function checkP6(rawText) {
  var score = 100, sgs = [];

  var errors = [
    { w: "既使", r: "即使" }, { w: "那怕是", r: "哪怕是" },
    { w: "一但", r: "一旦" }, { w: "年经", r: "年轻" },
    { w: "按装", r: "安装" }, { w: "搞", r: "完成/处理/执行" },
    { w: "弄", r: "完成/实现" }, { w: "那个", r: "删除或替换" }
  ];

  for (var i = 0; i < errors.length; i++) {
    if (rawText.indexOf(errors[i].w) !== -1) {
      score -= 8;
      sgs.push(makeSuggestion("language","high","可能存在错误：\"" + errors[i].w + "\"","","建议改为：" + errors[i].r));
      break;
    }
  }

  // 长句
  var sents = rawText.split(/[。！？；\n]/);
  var long = [];
  for (var i = 0; i < sents.length; i++) {
    var s = sents[i].trim();
    if (s.length > 60) long.push(s.substring(0,20) + "..." + s.length + "字");
  }
  if (long.length > 2) {
    score -= 5;
    sgs.push(makeSuggestion("language","low","存在较多长句", long.length + "处超过60字","建议拆分为短句，每句一个核心信息"));
  }

  return { score: Math.max(score,0), suggestions: sgs };
}

// ===== 工具函数 =====
function extractKeywords(text) {
  var words = text.split(/[\u3001\u3002\uff1b\uff1a\n\r\s,.;:!?()\[\]<>\/]/);
  var r = [];
  for (var i = 0; i < words.length; i++) {
    var w = words[i].trim();
    if (w.length >= 2 && w.length <= 20 && r.indexOf(w) === -1) r.push(w);
  }
  return r;
}

function calcTotal(scores) {
  var w = { professional: 20, ats: 20, structure: 15, quantifiable: 15, language: 10, jdMatch: 20 };
  var t = 0;
  for (var k in w) { if (scores[k] !== undefined) t += scores[k] * w[k] / 100; }
  return Math.round(t);
}

function genImprovePlan(scores) {
  var s = [], m = [], l = [];
  // 保真审核作为基础检查，不参与评分
  if (scores.professional < 80) { s.push({ done: false, text: "替换工作经历开头的动词为更有力的词汇（如`负责`->`主导/统筹`）" }); if (scores.professional < 60) m.push({ done: false, text: "重新组织工作描述，每个要点包含[动词+做了什么+结果]结构" }); }
  if (scores.ats < 70) m.push({ done: false, text: "调整章节标题为标准名称（工作经历、教育背景、专业技能等），确保ATS系统可识别" });
  if (scores.structure < 70) { s.push({ done: false, text: "按时间倒序排列工作经历，最新的放在最前面" }); m.push({ done: false, text: "确保每段经历都有起止时间和明确的职责描述" }); }
  if (scores.quantifiable < 60) { m.push({ done: false, text: "补充可量化的成果数据" }); l.push({ done: false, text: "日常工作中注意记录关键数据" }); }
  if (scores.language < 80) s.push({ done: false, text: "通读一遍简历，修正错别字和口语化表达" });
  return { shortTerm: s, mediumTerm: m, longTerm: l };
}



// ===== 主评估函数 =====
function evaluateResume(resumeText, targetJd, extraInfo) {
  if (extraInfo && extraInfo.trim()) {
    resumeText = resumeText + "\n\n【补充信息】\n" + extraInfo;
  }

  var structured = parseResume(resumeText);

  // 深度解析岗位描述
  var parsedJD = null;
  if (targetJd && targetJd.trim()) {
    parsedJD = parseJD(targetJd);
  }

  var p1 = checkP1(structured, resumeText);
  var p2 = checkP2(structured, resumeText, targetJd);
  var p3 = checkP3(structured, resumeText, targetJd);
  var p4 = checkP4(structured, resumeText);
  var p5 = checkP5(resumeText);
  var p6 = checkP6(resumeText);

  // JD驱动的深度匹配分析
  var jdMatch = checkJDMatch(structured, resumeText, parsedJD);

  var dimScores = {
    professional: p2.score,
    ats: p3.score,
    structure: p4.score,
    quantifiable: p5.score,
    language: p6.score,
    jdMatch: parsedJD ? calculateJDMatchScore(parsedJD, structured, resumeText) : 80
  };

  var all = [].concat(p2.suggestions, p3.suggestions, p4.suggestions, p5.suggestions, p6.suggestions, jdMatch.suggestions);

  // 按优先级排序
  var order = { critical: 0, high: 1, medium: 2, low: 3 };
  all.sort(function(a, b) { return (order[a.priority]||99) - (order[b.priority]||99); });

  var top = all.slice(0, 15);
  var total = calcTotal(dimScores);

  // 合并提升建议（基础 + JD驱动）
  var plan = genImprovePlan(dimScores);
  var jdPlan = genJDImprovePlan(dimScores, parsedJD);
  plan.shortTerm = plan.shortTerm.concat(jdPlan.shortTerm);
  plan.mediumTerm = plan.mediumTerm.concat(jdPlan.mediumTerm);
  plan.longTerm = plan.longTerm.concat(jdPlan.longTerm);

  // 如果有JD，在提升建议最前面加一条核心建议
  if (parsedJD) {
    plan.shortTerm.unshift({
      done: false,
      text: '核心目标：针对目标岗位要求逐条检查简历'
    });
  }

  var info = [];
  if (structured.personalInfo.name) info.push("姓名：" + structured.personalInfo.name);
  if (structured.personalInfo.phone) info.push("电话：" + structured.personalInfo.phone);
  if (structured.personalInfo.email) info.push("邮箱：" + structured.personalInfo.email);

  return {
    totalScore: total,
    dimensionScores: {
      "专业表达": { score: dimScores.professional, weight: 20 },
      "ATS兼容":  { score: dimScores.ats, weight: 20 },
      "内容结构": { score: dimScores.structure, weight: 15 },
      "可量化":   { score: dimScores.quantifiable, weight: 15 },
      "语言质量": { score: dimScores.language, weight: 10 },
      "岗位匹配": { score: dimScores.jdMatch || 0, weight: 20 },
    },
    suggestions: top,
    improvementPlan: plan,
    personalInfo: info
  };
}




// ============================================================
// 岗位匹配评分
// ============================================================

function calculateJDMatchScore(parsedJD, structured, rawText) {
  if (!parsedJD) return 80;
  var score = 60;
  var matched = 0;
  var total = 0;

  // 技术技能匹配
  if (parsedJD.skills.technical.length > 0) {
    total += parsedJD.skills.technical.length;
    for (var i = 0; i < parsedJD.skills.technical.length; i++) {
      if (rawText.indexOf(parsedJD.skills.technical[i]) !== -1) matched++;
    }
  }

  // 职责匹配
  if (parsedJD.responsibilities.length > 0) {
    total += parsedJD.responsibilities.length;
    for (var i = 0; i < parsedJD.responsibilities.length; i++) {
      var words = parsedJD.responsibilities[i].split(/[，,、\s]+/);
      var matchCount = 0;
      for (var j = 0; j < words.length; j++) {
        if (words[j].length > 2 && rawText.indexOf(words[j]) !== -1) matchCount++;
      }
      if (matchCount >= 2) matched++;
    }
  }

  var rate = total > 0 ? matched / total : 0;
  score += Math.round(rate * 40);
  return Math.min(Math.max(score, 0), 100);
}

// ============================================================
// 计算匹配等级：决定改写力度
// ============================================================

function calculateMatchLevel(dimScores, hasJD) {
  if (!hasJD) return "polish";  // 没有目标岗位，只做润色

  var jdScore = dimScores.jdMatch || 0;
  var totalScore = calcTotal(dimScores);

  // 综合判断
  if (jdScore < 40 || totalScore < 50) return "heavy";     // 低匹配 → 大修大改
  if (jdScore < 65 || totalScore < 70) return "medium";    // 中匹配 → 中度修改
  return "polish";                                           // 高匹配 → 小修小改
}

// ============================================================
// 自适应简历改写器
// ============================================================

function adaptRewrite(resumeText, targetJd, extraInfo, analysisResult) {
  if (!analysisResult) return { content: resumeText, level: "none", changes: [] };

  var dimScores = {};
  var dims = analysisResult.dimensionScores || {};
  for (var k in dims) {
    if (k === "专业表达") dimScores.professional = dims[k].score;
    else if (k === "ATS兼容") dimScores.ats = dims[k].score;
    else if (k === "内容结构") dimScores.structure = dims[k].score;
    else if (k === "可量化") dimScores.quantifiable = dims[k].score;
    else if (k === "语言质量") dimScores.language = dims[k].score;
    else if (k === "岗位匹配") dimScores.jdMatch = dims[k].score;
  }

  var hasJD = !!(targetJd && targetJd.trim());
  var level = calculateMatchLevel(dimScores, hasJD);

  // 根据匹配等级选择改写策略
  var result = resumeText;
  var changes = [];

  if (level === "heavy") {
    // 低匹配：大修大改
    // 1. 基础润色
    result = rewriteResume(result, analysisResult);
    // 2. 如果有关键词差距，补充技能
    if (hasJD) {
      var jdMatchResult = incorporateJDSkills(result, targetJd, analysisResult);
      result = jdMatchResult.content;
      changes = changes.concat(jdMatchResult.changes);
    }
  } else if (level === "medium") {
    // 中匹配：中度修改
    result = rewriteResume(result, analysisResult);
    if (hasJD) {
      var jdMatchResult = incorporateJDSkills(result, targetJd, analysisResult);
      result = jdMatchResult.content;
      changes = changes.concat(jdMatchResult.changes);
    }
  } else {
    // 高匹配或无JD：小修小改（仅润色）
    result = rewriteResume(result, analysisResult);
  }

  var levelLabel = level === "heavy" ? "大改" : (level === "medium" ? "中改" : "小改");
  return {
    content: result,
    level: level,
    levelLabel: levelLabel,
    changes: changes.concat(generateChangeSummary(resumeText, result))
  };
}

// ============================================================
// 根据JD补充技能
// ============================================================

function incorporateJDSkills(resumeText, targetJd, analysisResult) {
  if (!targetJd || !targetJd.trim()) return { content: resumeText, changes: [] };

  var parsedJD = parseJD(targetJd);
  if (!parsedJD || parsedJD.skills.technical.length === 0) return { content: resumeText, changes: [] };

  // 找出简历中缺少的技术技能
  var missingTech = [];
  for (var i = 0; i < parsedJD.skills.technical.length; i++) {
    var tech = parsedJD.skills.technical[i];
    if (tech.length > 2 && resumeText.indexOf(tech) === -1) {
      // 排除常见的英文单词
      if (!/^(the|and|for|with|from|this|that|have|will|would|could|should|shall|may|might|must|need|using|based|about|other|more|some|such|than|into|also|only|well|very|just|like|even|still|already|not|are|was|were|been|been|does|done)$/i.test(tech)) {
        missingTech.push(tech);
      }
    }
  }

  if (missingTech.length === 0) return { content: resumeText, changes: [] };

  // 检查是否有技能章节，如果有则补充
  var lines = resumeText.split("\n");
  var hasSkillSection = false;
  var skillSectionIdx = -1;

  for (var i = 0; i < lines.length; i++) {
    if (lines[i].trim() === "专业技能" || lines[i].trim() === "技能") {
      hasSkillSection = true;
      skillSectionIdx = i;
      break;
    }
  }

  if (hasSkillSection && skillSectionIdx >= 0) {
    // 在技能章节末尾追加
    var existingSkills = [];
    for (var i = skillSectionIdx + 1; i < Math.min(skillSectionIdx + 5, lines.length); i++) {
      var l = lines[i].trim();
      if (l && l.length > 0 && l.length < 50 && !/^[-•·]/.test(l)) {
        existingSkills.push(l);
      }
    }

    // 只在技能区追加（不修改已有内容）
    var insertIdx = skillSectionIdx + 1;
    while (insertIdx < lines.length && lines[insertIdx].trim()) insertIdx++;

    var techLine = "熟练掌握：" + missingTech.slice(0, 4).join("、");
    lines.splice(insertIdx, 0, "  " + techLine);
  } else {
    // 没有技能章节，在最后添加
    lines.push("");
    lines.push("专业技能");
    lines.push("  - 熟悉" + missingTech.slice(0, 4).join("、") + "等工具和技术");
  }

  var newText = lines.join("\n");
  return {
    content: newText,
    changes: [{ original: "（无）", improved: "根据岗位要求补充了：" + missingTech.slice(0, 4).join("、") }]
  };
}

// ============================================================
// 简历改写器：把分析建议真正写进简历
// ============================================================

var VERB_REPLACEMENTS = {
  "负责": ["主导", "统筹", "管理", "执行", "负责"],
  "参与": ["深度参与", "全程跟进", "协同完成"],
  "协助": ["协同", "配合", "支撑"],
  "做": ["完成", "实现", "搭建", "开发"],
  "弄": ["完成", "处理", "实现", "整理"],
  "搞": ["完成", "执行", "处理", "实现"],
  "从事": ["深耕", "专注", "从事"],
  "担任": ["担任"]
};

var VERBOSE_PATTERNS = [
  { re: /负责([^，。]*)的工作/g, replacement: "$1" },
  { re: /我的工作是([^，。]*)/g, replacement: "$1" },
  { re: /我主要负责([^，。]*)/g, replacement: "$1" },
  { re: /主要从事([^，。]*)/g, replacement: "$1" }
];

var COLLOQUIAL_WORDS = {
  "搞": "完成",
  "弄": "处理",
  "那个": "",
  "然后": "",
  "其实": "",
  "反正": "",
  "就是": ""
};

function rewriteResume(resumeText, analysisResult) {
  if (!analysisResult) return resumeText;

  var suggestions = analysisResult.suggestions || [];
  var lines = resumeText.split("\n");
  var result = [];

  // 分段落处理
  for (var i = 0; i < lines.length; i++) {
    var line = lines[i];
    var trimmed = line.trim();
    var indent = line.substring(0, line.length - line.trimLeft().length);

    // 1. 对每个要点进行处理（以 - · * 开头的行）
    if (/^[-\u00b7\u2022*]/.test(trimmed)) {
      var content = trimmed.substring(1).trim();
      var improved = rewriteBulletPoint(content, suggestions);
      result.push(indent + "- " + improved);
    }
    // 2. 对非要点行做基本清理
    else if (trimmed.length > 0) {
      result.push(indent + cleanupLine(trimmed));
    }
    // 3. 保留空行
    else {
      result.push(line);
    }
  }

  return result.join("\n");
}

function rewriteBulletPoint(text, suggestions) {
  if (!text || text.length < 3) return text;

  var original = text;
  var result = text;

  // 1. 替换弱动词
  for (var weak in VERB_REPLACEMENTS) {
    var wIdx = result.indexOf(weak); if (wIdx === 0 || (wIdx > 0 && wIdx <= 3)) {
      var replacements = VERB_REPLACEMENTS[weak];
      // 选择最合适的替换词（优先选第一个，即最强力的）
      var best = replacements[0];
      // 但如果原文是"负责"且后面跟的是日常维护类工作，"管理"可能更合适
      if (weak === "负责" && /维护|运营|支持/.test(result)) best = "负责";
      if (weak === "负责" && /项目|团队|部门/.test(result)) best = "主导";
      if (weak === "负责" && /开发|设计|架构/.test(result)) best = "主导";
      if (weak === "参与" && /核心|关键|重要/.test(result)) best = "深度参与";
      if (weak === "协助" && /主导|负责/.test(result)) best = "协同";

      result = result.replace(weak, best);
      break;
    }
  }

  // 2. 替换口语化词汇
  for (var col in COLLOQUIAL_WORDS) {
    var repl = COLLOQUIAL_WORDS[col];
    if (result.indexOf(col) !== -1) {
      if (repl) {
        result = result.replace(new RegExp(col, "g"), repl);
      } else {
        result = result.replace(new RegExp(col, "g"), "");
      }
    }
  }

  // 3. 去掉啰嗦模式
  for (var pi = 0; pi < VERBOSE_PATTERNS.length; pi++) {
    result = result.replace(VERBOSE_PATTERNS[pi].re, VERBOSE_PATTERNS[pi].replacement);
  }

  // 4. 如果只有一个动词没有具体描述，尝试补充框架
  var verbMatch = result.match(/^([\u4e00-\u9fa5]{2,4})/);
  if (verbMatch) {
    var verb = verbMatch[1];
    var afterVerb = result.substring(verb.length).trim();

    // 如果动词后内容太少（<5个字），补充基本结构
    if (afterVerb.length < 5 && afterVerb.length > 0) {
      // 不要生硬补充，保持原样
    }
  }

  // 5. 去重空格
  result = result.replace(/\s{2,}/g, " ").trim();

  // 6. 从建议中查找是否有针对此内容的具体建议，如果有则采纳
  for (var si = 0; si < suggestions.length; si++) {
    var s = suggestions[si];
    if (s.original && s.improved && original.indexOf(s.original) !== -1) {
      result = result.replace(s.original, s.improved);
    }
    if (s.original && s.improved && s.original.length > 5 && original.indexOf(s.original.substring(0, 5)) !== -1) {
      // 部分匹配也尝试替换
    }
  }

  return result || text;
}

function cleanupLine(text) {
  var result = text;

  // 去掉啰嗦表达
  for (var pi = 0; pi < VERBOSE_PATTERNS.length; pi++) {
    result = result.replace(VERBOSE_PATTERNS[pi].re, VERBOSE_PATTERNS[pi].replacement);
  }

  // 替换口语化词汇
  for (var col in COLLOQUIAL_WORDS) {
    var repl = COLLOQUIAL_WORDS[col];
    if (result.indexOf(col) !== -1) {
      if (repl) {
        result = result.replace(new RegExp(col, "g"), repl);
      } else {
        result = result.replace(new RegExp(col, "g"), "");
      }
    }
  }

  return result;
}

// ============================================================
// 强化AI提示词：把完整分析结果传给AI
// ============================================================

function buildAIPrompt(resumeText, targetJd, extraInfo, analysisResult) {
  var prompt = "你是一个专业的简历优化专家。请根据以下分析结果，优化这份简历。\n\n";
  prompt += "## 核心规则\n";
  prompt += "1. 绝对不能修改：任职时间、公司名/学校名、专业名称、职位名称\n";
  prompt += "2. 不能编造经历或夸大事实\n";
  prompt += "3. 保持事实一致性的前提下优化表达\n";
  prompt += "4. 如果有目标岗位描述，优先匹配岗位需求\n\n";

  prompt += "## 原始简历\n" + resumeText + "\n\n";

  if (targetJd && targetJd.trim()) {
    prompt += "## 目标岗位描述\n" + targetJd + "\n\n";
  }

  if (extraInfo && extraInfo.trim()) {
    prompt += "## 需要整合的补充信息\n" + extraInfo + "\n\n";
  }

  if (analysisResult) {
    prompt += "## 分析发现的优化点（必须处理以下问题）\n";
    var sugs = analysisResult.suggestions || [];
    if (sugs.length > 0) {
      sugs.slice(0, 10).forEach(function(s, i) {
        prompt += (i+1) + ". " + s.title;
        if (s.detail) prompt += "：" + s.detail.substring(0, 60);
        if (s.suggestion) prompt += " → " + s.suggestion.substring(0, 60);
        prompt += "\n";
      });
    }
    prompt += "\n";
  }

  prompt += "## 输出要求\n";
  prompt += "请输出优化后的完整简历文本（不要有任何解释性文字）。\n";
  prompt += "注意保留原简历的章节结构，但优化每段描述的措辞和表达。";

  return prompt;
}

// 从分析结果生成改进摘要（供前端展示）
function generateChangeSummary(originalText, rewrittenText) {
  if (originalText === rewrittenText) {
    return [];
  }

  var summary = [];
  var origLines = originalText.split("\n");
  var newLines = rewrittenText.split("\n");

  for (var i = 0; i < Math.min(origLines.length, newLines.length); i++) {
    var o = origLines[i].trim();
    var n = newLines[i].trim();
    if (o !== n && o.length > 5 && n.length > 5) {
      summary.push({
        original: o.substring(0, 50),
        improved: n.substring(0, 50)
      });
    }
  }

  return summary.slice(0, 5);
}

module.exports = { evaluateResume, rewriteResume, buildAIPrompt, generateChangeSummary, adaptRewrite, calculateMatchLevel };
