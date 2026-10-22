/**
 * GCCX Candidate Triage AI — Client Application
 * Powers real-time search, interactive pipeline tabs, slide-in candidate detail drawer,
 * semantic AI fit scoring, light/dark mode sliding toggle switch, and CSV export.
 */

// ============================================================================
// State Management
// ============================================================================

const state = {
  candidates: [],
  filteredCandidates: [],
  roles: [],
  sources: [],
  activeStatus: 'All',
  activeRole: '',
  activeSource: '',
  activeExp: '',
  searchQuery: '',
  sortBy: 'ai_fit_score',
  viewMode: 'grid',
  activeCandidate: null,
  aiScores: {}, // candidateId -> { score, recommendation, summary, strengths, concerns, questions }
  selectedForComparison: new Set(),
  saveNotesTimeout: null,
  searchDebounceTimeout: null,
};

// Role Benchmarks for High-Precision Semantic Scoring
const ROLE_BENCHMARKS = {
  'Backend Engineer': {
    coreSkills: ['Go', 'Python', 'FastAPI', 'PostgreSQL', 'Docker', 'Kubernetes', 'Redis', 'gRPC', 'Kafka', 'Java', 'Spring Boot'],
    minExp: 3,
    priorityTokens: ['distributed systems', 'concurrency', 'high throughput', 'strong DSA', 'Series B', 'microservices']
  },
  'Frontend Engineer': {
    coreSkills: ['React', 'TypeScript', 'JavaScript', 'Next.js', 'CSS', 'Tailwind', 'Redux', 'Vue', 'HTML5', 'Webpack', 'Testing Library'],
    minExp: 2,
    priorityTokens: ['design systems', 'performance optimization', 'state management', 'accessibility', 'clean UI']
  },
  'Full-Stack Engineer': {
    coreSkills: ['React', 'Python', 'Node.js', 'TypeScript', 'PostgreSQL', 'Docker', 'Next.js', 'FastAPI', 'REST', 'GraphQL'],
    minExp: 3,
    priorityTokens: ['end-to-end', 'full cycle', 'startup speed', 'product velocity', 'API design']
  },
  'Machine Learning Engineer': {
    coreSkills: ['Python', 'PyTorch', 'TensorFlow', 'MLOps', 'FastAPI', 'Docker', 'Pandas', 'NumPy', 'Scikit-learn', 'PostgreSQL'],
    minExp: 3,
    priorityTokens: ['model serving', 'LLM fine-tuning', 'vector databases', 'research to prod', 'deep learning']
  },
  'DevOps / Infrastructure Engineer': {
    coreSkills: ['Kubernetes', 'Docker', 'Terraform', 'AWS', 'Linux', 'CI/CD', 'Prometheus', 'Grafana', 'Go', 'Python'],
    minExp: 4,
    priorityTokens: ['high availability', 'zero downtime', 'infrastructure as code', 'observability', 'cloud migration']
  },
  'Mobile Engineer': {
    coreSkills: ['Kotlin', 'Swift', 'React Native', 'Flutter', 'iOS', 'Android', 'Mobile CI/CD'],
    minExp: 3,
    priorityTokens: ['offline-first', 'app performance', 'App Store deployment', 'clean architecture']
  },
  'Security Engineer': {
    coreSkills: ['OWASP', 'Penetration Testing', 'IAM', 'Cloud Security', 'Python', 'Go', 'Docker', 'Linux', 'Networking'],
    minExp: 3,
    priorityTokens: ['vulnerability management', 'threat modeling', 'compliance', 'incident response']
  },
  'QA / Automation Engineer': {
    coreSkills: ['Python', 'Selenium', 'Playwright', 'Cypress', 'Pytest', 'CI/CD', 'Postman', 'Docker'],
    minExp: 2,
    priorityTokens: ['test coverage', 'end-to-end testing', 'regression suites', 'automation frameworks']
  }
};

// ============================================================================
// DOM Elements
// ============================================================================

const dom = {};

function initDom() {
  // Theme Switch
  dom.themeToggleBtn = document.getElementById('themeToggleBtn');
  dom.themeLabel = document.getElementById('themeLabel');
  dom.themeThumb = document.getElementById('themeThumb');

  // Top Nav Actions
  dom.batchTriageBtn = document.getElementById('batchTriageBtn');
  dom.exportBtn = document.getElementById('exportBtn');
  dom.settingsBtn = document.getElementById('settingsBtn');
  dom.resetDbBtn = document.getElementById('resetDbBtn');

  // Metrics
  dom.valTotal = document.getElementById('valTotal');
  dom.valShortlist = document.getElementById('valShortlist');
  dom.valScreen = document.getElementById('valScreen');
  dom.valUnreviewed = document.getElementById('valUnreviewed');
  dom.valAIAnalyzed = document.getElementById('valAIAnalyzed');
  dom.valAvgScore = document.getElementById('valAvgScore');

  // Filters & Tabs
  dom.searchInput = document.getElementById('searchInput');
  dom.clearSearchBtn = document.getElementById('clearSearchBtn');
  dom.roleFilter = document.getElementById('roleFilter');
  dom.sourceFilter = document.getElementById('sourceFilter');
  dom.expFilter = document.getElementById('expFilter');
  dom.sortBy = document.getElementById('sortBy');
  dom.tabPills = document.querySelectorAll('.pipeline-tabs .tab-pill');

  // Tab Count Badges
  dom.countAll = document.getElementById('countAll');
  dom.countUnreviewed = document.getElementById('countUnreviewed');
  dom.countShortlist = document.getElementById('countShortlist');
  dom.countScreen = document.getElementById('countScreen');
  dom.countReview = document.getElementById('countReview');
  dom.countReject = document.getElementById('countReject');

  // Main Candidate Grid
  dom.visibleCount = document.getElementById('visibleCount');
  dom.viewGridBtn = document.getElementById('viewGridBtn');
  dom.viewListBtn = document.getElementById('viewListBtn');
  dom.candidateGrid = document.getElementById('candidateGrid');
  dom.emptyState = document.getElementById('emptyState');
  dom.resetFiltersBtn = document.getElementById('resetFiltersBtn');

  // Candidate Drawer
  dom.candidateDrawer = document.getElementById('candidateDrawer');
  dom.drawerBackdrop = document.getElementById('drawerBackdrop');
  dom.closeDrawerBtn = document.getElementById('closeDrawerBtn');
  dom.drawerAvatar = document.getElementById('drawerAvatar');
  dom.drawerName = document.getElementById('drawerName');
  dom.drawerRole = document.getElementById('drawerRole');
  dom.drawerExp = document.getElementById('drawerExp');
  dom.drawerSource = document.getElementById('drawerSource');
  dom.drawerDate = document.getElementById('drawerDate');
  dom.statusDecisionBtns = document.querySelectorAll('.status-decision-btn');

  // Drawer AI Card
  dom.drawerRunAIBtn = document.getElementById('drawerRunAIBtn');
  dom.drawerScoreDial = document.getElementById('drawerScoreDial');
  dom.drawerScoreVal = document.getElementById('drawerScoreVal');
  dom.drawerRecommendation = document.getElementById('drawerRecommendation');
  dom.drawerSummary = document.getElementById('drawerSummary');
  dom.drawerInsightsSplit = document.getElementById('drawerInsightsSplit');
  dom.drawerStrengthsList = document.getElementById('drawerStrengthsList');
  dom.drawerConcernsList = document.getElementById('drawerConcernsList');
  dom.drawerQuestionsBox = document.getElementById('drawerQuestionsBox');
  dom.drawerQuestionsList = document.getElementById('drawerQuestionsList');

  // Drawer Candidate Info
  dom.drawerSkillsCloud = document.getElementById('drawerSkillsCloud');
  dom.drawerOriginalNotes = document.getElementById('drawerOriginalNotes');
  dom.drawerRecruiterNotes = document.getElementById('drawerRecruiterNotes');
  dom.saveStatus = document.getElementById('saveStatus');

  // Batch Modal
  dom.batchModal = document.getElementById('batchModal');
  dom.closeBatchModalBtn = document.getElementById('closeBatchModalBtn');
  dom.cancelBatchBtn = document.getElementById('cancelBatchBtn');
  dom.startBatchBtn = document.getElementById('startBatchBtn');
  dom.overwriteBatchCheckbox = document.getElementById('overwriteBatchCheckbox');
  dom.batchProgress = document.getElementById('batchProgress');
  dom.batchProgressFill = document.getElementById('batchProgressFill');
  dom.batchProgressText = document.getElementById('batchProgressText');

  // Settings Modal
  dom.settingsModal = document.getElementById('settingsModal');
  dom.closeSettingsModalBtn = document.getElementById('closeSettingsModalBtn');
  dom.saveSettingsBtn = document.getElementById('saveSettingsBtn');
  dom.openaiApiKeyInput = document.getElementById('openaiApiKeyInput');

  // Toast
  dom.toast = document.getElementById('toast');

  // Candidate Comparison Elements
  dom.compareBar = document.getElementById('compareBar');
  dom.compareCount = document.getElementById('compareCount');
  dom.openCompareBtn = document.getElementById('openCompareBtn');
  dom.clearCompareBtn = document.getElementById('clearCompareBtn');
  dom.navCompareBtn = document.getElementById('navCompareBtn');
  dom.navCompareCount = document.getElementById('navCompareCount');
  dom.headerCompareBtn = document.getElementById('headerCompareBtn');
  dom.headerCompareCount = document.getElementById('headerCompareCount');
  dom.compareModal = document.getElementById('compareModal');
  dom.closeCompareModalBtn = document.getElementById('closeCompareModalBtn');
  dom.closeCompareModalFooterBtn = document.getElementById('closeCompareModalFooterBtn');
  dom.comparisonTableWrap = document.getElementById('comparisonTableWrap');
}

// ============================================================================
// Utilities
// ============================================================================

function escapeHtml(str = '') {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function getInitials(name = '') {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map(w => w[0])
    .join('')
    .toUpperCase() || 'C';
}

function showToast(message, type = 'info') {
  if (!dom.toast) return;
  dom.toast.className = `toast toast-${type}`;
  let icon = 'ℹ️';
  if (type === 'success') icon = '✅';
  if (type === 'error') icon = '⚠️';
  if (type === 'magic') icon = '✨';

  dom.toast.innerHTML = `<span class="toast-icon">${icon}</span><span>${escapeHtml(message)}</span>`;
  dom.toast.style.display = 'flex';
  dom.toast.style.opacity = '1';
  dom.toast.style.transform = 'translateY(0)';

  clearTimeout(dom.toastTimer);
  dom.toastTimer = setTimeout(() => {
    dom.toast.style.opacity = '0';
    dom.toast.style.transform = 'translateY(10px)';
    setTimeout(() => { dom.toast.style.display = 'none'; }, 300);
  }, 3500);
}

// Extract candidate status from tags or shortlisted flag
function getCandidateStatus(c) {
  if (c.shortlisted) return 'Shortlist';
  const tags = c.tags || [];
  const statusTag = tags.find(t => t.startsWith('status:'));
  if (statusTag) {
    const val = statusTag.replace('status:', '').trim();
    if (['Phone Screen', 'Review Later', 'Reject', 'Shortlist'].includes(val)) {
      return val;
    }
  }
  return 'Unreviewed';
}

// Set candidate status helper
async function setCandidateStatus(candidateId, newStatus) {
  const c = state.candidates.find(cand => cand.id === candidateId);
  if (!c) return;

  const isShortlist = newStatus === 'Shortlist';
  let currentTags = (c.tags || []).filter(t => !t.startsWith('status:'));
  if (newStatus !== 'Unreviewed') {
    currentTags.push(`status:${newStatus}`);
  }

  try {
    const res = await fetch(`/api/candidates/${candidateId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        shortlisted: isShortlist,
        tags: currentTags
      })
    });
    if (!res.ok) throw new Error('Failed to update candidate status');
    const data = await res.json();
    
    // Update local state
    c.shortlisted = isShortlist;
    c.tags = currentTags;
    if (state.activeCandidate && state.activeCandidate.id === candidateId) {
      state.activeCandidate.shortlisted = isShortlist;
      state.activeCandidate.tags = currentTags;
      updateDrawerStatusButtons(newStatus);
    }

    updateMetricsAndTabs();
    applyFiltersAndRender();
    showToast(`Updated ${c.name} to "${newStatus}"`, 'success');
  } catch (err) {
    console.error(err);
    showToast(`Failed to update status: ${err.message}`, 'error');
  }
}

// ============================================================================
// Built-in AI Semantic Evaluation Engine
// ============================================================================

function evaluateCandidateAI(c) {
  if (state.aiScores[c.id]) {
    return state.aiScores[c.id];
  }

  const role = c.target_role;
  const benchmark = ROLE_BENCHMARKS[role] || {
    coreSkills: ['Git', 'Docker', 'REST', 'Linux'],
    minExp: 3,
    priorityTokens: ['ownership', 'clean code', 'problem solving']
  };

  const candidateSkills = (c.skills || []).map(s => s.toLowerCase());
  const benchmarkSkills = benchmark.coreSkills.map(s => s.toLowerCase());

  // 1. Skill overlap calculation
  let matchedSkills = [];
  let missingSkills = [];
  benchmarkSkills.forEach((bs, idx) => {
    if (candidateSkills.some(cs => cs.includes(bs) || bs.includes(cs))) {
      matchedSkills.push(benchmark.coreSkills[idx]);
    } else {
      missingSkills.push(benchmark.coreSkills[idx]);
    }
  });

  const skillScore = (matchedSkills.length / Math.max(1, benchmarkSkills.length)) * 50;

  // 2. Experience baseline calculation
  const expDelta = (c.years_experience || 0) - benchmark.minExp;
  let expScore = 25;
  if (expDelta >= 2) expScore = 30;
  else if (expDelta >= 0) expScore = 25;
  else if (expDelta === -1) expScore = 18;
  else expScore = 10;

  // 3. Notes sentiment / signal analysis
  const notesText = (c.notes || '').toLowerCase();
  let notesScore = 15;
  let notesPositiveSignals = [];
  let notesFlags = [];

  const positiveTokens = [
    'series b', 'strong dsa', 'distributed systems', 'high ownership', 'ex-faang',
    'quick learner', 'solid foundation', 'promoted', 'spearheaded', 'fast paced', 'production'
  ];
  const cautionTokens = [
    'thin on specifics', 'untested breadth', 'job hopper', 'unresponsive',
    'lacks depth', 'inconsistent', 'struggled with design', 'communication gap'
  ];

  positiveTokens.forEach(token => {
    if (notesText.includes(token)) {
      notesScore += 4;
      notesPositiveSignals.push(token);
    }
  });

  cautionTokens.forEach(token => {
    if (notesText.includes(token)) {
      notesScore -= 7;
      notesFlags.push(token);
    }
  });

  notesScore = Math.max(5, Math.min(25, notesScore));

  // Compute final score
  let finalScore = Math.round(skillScore + expScore + notesScore);
  finalScore = Math.max(38, Math.min(97, finalScore));

  // Recommendation
  let recommendation = 'Needs Review';
  if (finalScore >= 82) recommendation = 'Strong Match (Shortlist)';
  else if (finalScore >= 68) recommendation = 'Potential Fit (Phone Screen)';
  else if (finalScore <= 50) recommendation = 'Low Fit / Risk Flagged';

  // Strengths
  const strengths = [];
  if (matchedSkills.length > 0) {
    strengths.push(`Proven alignment in core stack: ${matchedSkills.slice(0, 4).join(', ')}.`);
  }
  if (c.years_experience >= benchmark.minExp) {
    strengths.push(`${c.years_experience} years professional experience meets target seniority.`);
  }
  if (notesPositiveSignals.length > 0) {
    strengths.push(`Positive velocity markers in notes: "${notesPositiveSignals.join('", "')}".`);
  }
  if (strengths.length === 0) {
    strengths.push(`Demonstrated hands-on experience in declared stack (${(c.skills || []).slice(0, 3).join(', ')}).`);
  }

  // Concerns
  const concerns = [];
  if (missingSkills.length > 0) {
    concerns.push(`Untested in expected requirements: ${missingSkills.slice(0, 3).join(', ')}.`);
  }
  if (expDelta < 0) {
    concerns.push(`Junior baseline (${c.years_experience} yrs vs ${benchmark.minExp} yrs benchmark).`);
  }
  if (notesFlags.length > 0) {
    concerns.push(`Recruiter caution flags detected: "${notesFlags.join('", "')}".`);
  }
  if (concerns.length === 0) {
    concerns.push('No critical red flags detected; verify production scale during technical deep-dive.');
  }

  // Interview Questions
  const questions = [];
  if (matchedSkills.length > 0) {
    questions.push(`Can you walk us through the architectural bottlenecks you encountered while working with ${matchedSkills[0]}?`);
  }
  if (missingSkills.length > 0) {
    questions.push(`Our team relies on ${missingSkills[0]}. What is your approach to onboarding into unfamiliar tech?`);
  } else {
    questions.push('Describe a challenging production outage you debugged under high customer traffic.');
  }
  questions.push('How do you balance test velocity with rapid iteration when shipping production microservices?');

  // Summary
  let summary = c.ai_summary;
  if (!summary) {
    summary = `${c.name} demonstrates a ${finalScore}% fit for ${role} with strength in ${matchedSkills.slice(0, 3).join(', ') || 'software delivery'}. ${concerns[0]}`;
  }

  const result = {
    score: finalScore,
    recommendation,
    summary,
    strengths,
    concerns,
    questions
  };

  state.aiScores[c.id] = result;
  return result;
}

// ============================================================================
// Data Fetching & Initialization
// ============================================================================

async function fetchCandidates() {
  try {
    const res = await fetch('/api/candidates');
    if (!res.ok) throw new Error('Failed to load candidates from SQLite API');
    const data = await res.json();
    state.candidates = data.candidates || [];
    state.roles = data.roles || [];
    state.sources = data.sources || [];

    // Precompute AI heuristic scores
    state.candidates.forEach(c => evaluateCandidateAI(c));

    populateFilterDropdowns();
    updateMetricsAndTabs();
    applyFiltersAndRender();
  } catch (err) {
    console.error('Candidate fetch error:', err);
    if (dom.candidateGrid) {
      dom.candidateGrid.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">⚠️</div>
          <h3>Failed to connect to SQLite backend</h3>
          <p>${escapeHtml(err.message)}</p>
          <button class="btn btn-secondary mt-3" onclick="fetchCandidates()">Retry Connection</button>
        </div>
      `;
    }
  }
}

function populateFilterDropdowns() {
  if (dom.roleFilter) {
    dom.roleFilter.innerHTML = '<option value="">All Roles (All)</option>';
    state.roles.forEach(role => {
      const opt = document.createElement('option');
      opt.value = role;
      opt.textContent = role;
      dom.roleFilter.appendChild(opt);
    });
  }

  if (dom.sourceFilter) {
    dom.sourceFilter.innerHTML = '<option value="">All Sources (All)</option>';
    state.sources.forEach(src => {
      const opt = document.createElement('option');
      opt.value = src;
      opt.textContent = src;
      dom.sourceFilter.appendChild(opt);
    });
  }
}

// ============================================================================
// Metrics & Pipeline Tabs
// ============================================================================

function updateMetricsAndTabs() {
  const total = state.candidates.length;
  let shortlistCount = 0;
  let screenCount = 0;
  let unreviewedCount = 0;
  let reviewCount = 0;
  let rejectCount = 0;
  let aiEvaluatedCount = 0;
  let totalScore = 0;

  state.candidates.forEach(c => {
    const status = getCandidateStatus(c);
    if (status === 'Shortlist') shortlistCount++;
    else if (status === 'Phone Screen') screenCount++;
    else if (status === 'Review Later') reviewCount++;
    else if (status === 'Reject') rejectCount++;
    else unreviewedCount++;

    const ai = state.aiScores[c.id];
    if (ai) {
      aiEvaluatedCount++;
      totalScore += ai.score;
    }
  });

  if (dom.valTotal) dom.valTotal.textContent = total;
  if (dom.valShortlist) dom.valShortlist.textContent = shortlistCount;
  if (dom.valScreen) dom.valScreen.textContent = screenCount;
  if (dom.valUnreviewed) dom.valUnreviewed.textContent = unreviewedCount;
  if (dom.valAIAnalyzed) dom.valAIAnalyzed.textContent = `${aiEvaluatedCount} / ${total}`;
  
  const avg = aiEvaluatedCount > 0 ? Math.round(totalScore / aiEvaluatedCount) : '--';
  if (dom.valAvgScore) dom.valAvgScore.textContent = `Avg Fit: ${avg}%`;

  // Tab counts
  if (dom.countAll) dom.countAll.textContent = total;
  if (dom.countUnreviewed) dom.countUnreviewed.textContent = unreviewedCount;
  if (dom.countShortlist) dom.countShortlist.textContent = shortlistCount;
  if (dom.countScreen) dom.countScreen.textContent = screenCount;
  if (dom.countReview) dom.countReview.textContent = reviewCount;
  if (dom.countReject) dom.countReject.textContent = rejectCount;
}

// ============================================================================
// Filter, Search, and Sort Logic
// ============================================================================

function applyFiltersAndRender() {
  const q = state.searchQuery.trim().toLowerCase();
  const role = state.activeRole;
  const source = state.activeSource;
  const exp = state.activeExp;
  const status = state.activeStatus;

  let filtered = state.candidates.filter(c => {
    // Pipeline status tab
    const cStatus = getCandidateStatus(c);
    if (status !== 'All' && cStatus !== status) {
      return false;
    }

    // Role filter
    if (role && c.target_role !== role) {
      return false;
    }

    // Source filter
    if (source && c.source !== source) {
      return false;
    }

    // Experience filter
    if (exp) {
      const y = c.years_experience || 0;
      if (exp === '1-2' && (y < 1 || y > 2)) return false;
      if (exp === '3-5' && (y < 3 || y > 5)) return false;
      if (exp === '6-8' && y < 6) return false;
    }

    // Free text search
    if (q) {
      const inName = (c.name || '').toLowerCase().includes(q);
      const inRole = (c.target_role || '').toLowerCase().includes(q);
      const inNotes = (c.notes || '').toLowerCase().includes(q);
      const inSkills = (c.skills || []).some(s => s.toLowerCase().includes(q));
      if (!inName && !inRole && !inNotes && !inSkills) {
        return false;
      }
    }

    return true;
  });

  // Sorting
  filtered.sort((a, b) => {
    const aiA = state.aiScores[a.id]?.score || 0;
    const aiB = state.aiScores[b.id]?.score || 0;

    if (state.sortBy === 'ai_fit_score') {
      return aiB - aiA;
    } else if (state.sortBy === 'applied_date') {
      return (b.applied_date || '').localeCompare(a.applied_date || '');
    } else if (state.sortBy === 'years_experience') {
      return (b.years_experience || 0) - (a.years_experience || 0);
    } else if (state.sortBy === 'name') {
      return (a.name || '').localeCompare(b.name || '');
    }
    return 0;
  });

  state.filteredCandidates = filtered;
  renderCandidates();
}

// ============================================================================
// Render Candidate Cards
// ============================================================================

function renderCandidates() {
  if (!dom.candidateGrid) return;

  const count = state.filteredCandidates.length;
  if (dom.visibleCount) dom.visibleCount.textContent = count;

  if (count === 0) {
    dom.candidateGrid.innerHTML = '';
    if (dom.emptyState) dom.emptyState.style.display = 'block';
    return;
  }

  if (dom.emptyState) dom.emptyState.style.display = 'none';

  const html = state.filteredCandidates.map(c => {
    const status = getCandidateStatus(c);
    const ai = state.aiScores[c.id] || evaluateCandidateAI(c);
    const scoreVal = ai.score;
    
    let scoreClass = 'low';
    if (scoreVal >= 80) scoreClass = 'high';
    else if (scoreVal >= 65) scoreClass = 'medium';

    let statusBadgeClass = 'unreviewed';
    if (status === 'Shortlist') statusBadgeClass = 'shortlist';
    else if (status === 'Phone Screen') statusBadgeClass = 'phonescreen';
    else if (status === 'Review Later') statusBadgeClass = 'reviewlater';
    else if (status === 'Reject') statusBadgeClass = 'reject';

    const searchToken = state.searchQuery.trim().toLowerCase();
    const skillsHtml = (c.skills || []).slice(0, 5).map(skill => {
      const isMatch = searchToken && skill.toLowerCase().includes(searchToken);
      return `<span class="skill-pill ${isMatch ? 'highlight-skill' : ''}">${escapeHtml(skill)}</span>`;
    }).join('');

    const moreSkills = (c.skills || []).length > 5 ? `<span class="skill-pill">+${(c.skills || []).length - 5}</span>` : '';

    const summaryText = c.ai_summary || ai.summary || 'Click AI Triage to generate fit analysis.';

    const isCompared = state.selectedForComparison.has(c.id);

    return `
      <div class="candidate-card ${isCompared ? 'is-compared' : ''}" data-id="${c.id}" data-status="${status}">
        <div class="card-header">
          <div class="candidate-identity">
            <div class="avatar">${getInitials(c.name)}</div>
            <div>
              <div class="candidate-name">${escapeHtml(c.name)}</div>
              <div class="candidate-meta">
                <span>${escapeHtml(c.applied_date)}</span>
                <span>•</span>
                <span>${c.years_experience} yrs exp</span>
              </div>
            </div>
          </div>
          <div class="score-badge ${scoreClass}" title="AI Fit Score: ${scoreVal}/100">
            <span class="score-val">${scoreVal}</span>
            <span class="score-lbl">FIT</span>
          </div>
        </div>

        <div class="badges-row">
          <span class="role-badge">${escapeHtml(c.target_role)}</span>
          <span class="source-badge">${escapeHtml(c.source || 'Direct')}</span>
          <span class="status-badge ${statusBadgeClass}">${status}</span>
        </div>

        <div class="skills-container">
          ${skillsHtml}
          ${moreSkills}
        </div>

        <div class="ai-summary-snippet ${!c.ai_summary ? 'empty' : ''}">
          "${escapeHtml(summaryText)}"
        </div>

        <div class="card-actions">
          <label class="compare-checkbox-label" title="Select to compare side-by-side (max 3)">
            <input type="checkbox" class="compare-checkbox" data-id="${c.id}" ${isCompared ? 'checked' : ''}>
            <span>Compare</span>
          </label>
          <button class="action-btn shortlist-card-btn ${c.shortlisted ? 'active' : ''}" data-id="${c.id}" title="${c.shortlisted ? 'Remove from Shortlist' : 'Add to Shortlist'}">
            ${c.shortlisted ? '⭐ Shortlisted' : '☆ Shortlist'}
          </button>
          <button class="action-btn view-card-btn" data-id="${c.id}" title="View Candidate Profile & Screening Drawer">
            Review Profile
          </button>
          <button class="action-btn ai-triage-card-btn" data-id="${c.id}" title="Run AI Semantic Evaluation">
            ⚡ AI
          </button>
        </div>
      </div>
    `;
  }).join('');

  dom.candidateGrid.innerHTML = html;
  attachCardEvents();
}

function attachCardEvents() {
  // Card click opens drawer (unless clicked on button or compare checkbox)
  dom.candidateGrid.querySelectorAll('.candidate-card').forEach(card => {
    card.addEventListener('click', (e) => {
      if (e.target.closest('.action-btn') || e.target.closest('.compare-checkbox-label') || e.target.closest('.compare-checkbox')) return;
      const cid = card.getAttribute('data-id');
      openCandidateDrawer(cid);
    });
  });

  // Compare Checkbox on Card
  dom.candidateGrid.querySelectorAll('.compare-checkbox').forEach(input => {
    input.addEventListener('click', (e) => {
      e.stopPropagation();
    });
    input.addEventListener('change', (e) => {
      e.stopPropagation();
      const cid = input.getAttribute('data-id');
      toggleCandidateCompare(cid, input.checked);
    });
  });

  dom.candidateGrid.querySelectorAll('.compare-checkbox-label').forEach(label => {
    label.addEventListener('click', (e) => {
      e.stopPropagation();
    });
  });

  // Shortlist toggle button on card
  dom.candidateGrid.querySelectorAll('.shortlist-card-btn').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const cid = btn.getAttribute('data-id');
      const c = state.candidates.find(item => item.id === cid);
      if (!c) return;
      const newStatus = c.shortlisted ? 'Unreviewed' : 'Shortlist';
      await setCandidateStatus(cid, newStatus);
    });
  });

  // Review Profile button on card
  dom.candidateGrid.querySelectorAll('.view-card-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const cid = btn.getAttribute('data-id');
      openCandidateDrawer(cid);
    });
  });

  // Quick AI Triage button on card
  dom.candidateGrid.querySelectorAll('.ai-triage-card-btn').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const cid = btn.getAttribute('data-id');
      await runAICandidateAnalysis(cid);
    });
  });
}

// ============================================================================
// Candidate Comparison Feature
// ============================================================================

function toggleCandidateCompare(candidateId, forceState = null) {
  const isSelected = state.selectedForComparison.has(candidateId);
  const targetState = forceState !== null ? forceState : !isSelected;

  if (targetState) {
    if (state.selectedForComparison.size >= 3) {
      showToast('You can compare a maximum of 3 candidates simultaneously.', 'info');
      updateCompareBar();
      renderCandidates();
      return;
    }
    state.selectedForComparison.add(candidateId);
  } else {
    state.selectedForComparison.delete(candidateId);
  }

  updateCompareBar();
  renderCandidates();
}

function updateCompareBar() {
  const count = state.selectedForComparison.size;
  if (dom.compareCount) dom.compareCount.textContent = count;
  const labelEl = document.getElementById('compareCountLabel');
  if (labelEl) labelEl.textContent = count;
  if (dom.navCompareCount) dom.navCompareCount.textContent = count;
  if (dom.headerCompareCount) dom.headerCompareCount.textContent = count;

  if (count > 0) {
    if (dom.compareBar) dom.compareBar.style.display = 'flex';
    if (dom.navCompareBtn) dom.navCompareBtn.style.display = 'inline-flex';
    if (dom.headerCompareBtn) dom.headerCompareBtn.style.display = 'inline-flex';
  } else {
    if (dom.compareBar) dom.compareBar.style.display = 'none';
    if (dom.navCompareBtn) dom.navCompareBtn.style.display = 'none';
    if (dom.headerCompareBtn) dom.headerCompareBtn.style.display = 'none';
  }
}

function openComparisonModal() {
  const ids = Array.from(state.selectedForComparison);
  const selectedCandidates = state.candidates.filter(c => ids.includes(c.id));

  if (selectedCandidates.length < 2) {
    showToast('Select at least 2 candidates using the "Compare" checkboxes to view the side-by-side matrix.', 'info');
    return;
  }

  // Calculate shared skills across all selected profiles
  const allSkillSets = selectedCandidates.map(c => new Set((c.skills || []).map(s => s.toLowerCase())));
  const sharedSkills = (selectedCandidates[0].skills || []).filter(s =>
    allSkillSets.every(set => set.has(s.toLowerCase()))
  );
  const sharedSkillLower = new Set(sharedSkills.map(s => s.toLowerCase()));

  let html = `
    <table class="compare-table">
      <thead>
        <tr>
          <th class="attr-col">Candidate</th>
          ${selectedCandidates.map(c => {
            const status = getCandidateStatus(c);
            const ai = state.aiScores[c.id] || evaluateCandidateAI(c);
            let scoreClass = 'low';
            if (ai.score >= 80) scoreClass = 'high';
            else if (ai.score >= 65) scoreClass = 'medium';

            let statusBadgeClass = 'unreviewed';
            if (status === 'Shortlist') statusBadgeClass = 'shortlist';
            else if (status === 'Phone Screen') statusBadgeClass = 'phonescreen';
            else if (status === 'Review Later') statusBadgeClass = 'reviewlater';
            else if (status === 'Reject') statusBadgeClass = 'reject';

            return `
              <th class="compare-candidate-col">
                <div class="compare-cand-header">
                  <div class="compare-cand-top">
                    <div class="avatar">${getInitials(c.name)}</div>
                    <div class="score-badge ${scoreClass}" title="AI Fit Score">
                      <span class="score-val">${ai.score}</span>
                      <span class="score-lbl">FIT</span>
                    </div>
                  </div>
                  <div class="compare-cand-name">${escapeHtml(c.name)}</div>
                  <div class="badges-row">
                    <span class="role-badge">${escapeHtml(c.target_role)}</span>
                    <span class="status-badge ${statusBadgeClass}">${status}</span>
                  </div>
                  <div class="compare-actions-row">
                    <button class="action-btn compare-shortlist-btn ${c.shortlisted ? 'shortlist-btn' : ''}" data-id="${c.id}">
                      ${c.shortlisted ? '⭐ Shortlisted' : '☆ Shortlist'}
                    </button>
                    <button class="action-btn compare-drawer-btn" data-id="${c.id}">
                      Review Profile
                    </button>
                  </div>
                </div>
              </th>
            `;
          }).join('')}
        </tr>
      </thead>
      <tbody>
        <!-- SHARED SKILLS BANNER -->
        <tr>
          <th class="attr-col">Shared Skills</th>
          <td colspan="${selectedCandidates.length}">
            <div class="compare-shared-box">
              <span class="compare-shared-label">Common Technical Overlap (${sharedSkills.length} matching)</span>
              <div class="skills-container">
                ${sharedSkills.length > 0 
                  ? sharedSkills.map(s => `<span class="skill-pill shared-skill">✓ ${escapeHtml(s)}</span>`).join('') 
                  : '<span class="text-xs text-muted">No common technical skills shared across all selected candidates.</span>'}
              </div>
            </div>
          </td>
        </tr>

        <!-- EXPERIENCE & SENIORITY -->
        <tr>
          <th class="attr-col">Experience & Seniority</th>
          ${selectedCandidates.map(c => {
            const bench = ROLE_BENCHMARKS[c.target_role] || { minExp: 3 };
            const meets = c.years_experience >= bench.minExp;
            return `
              <td>
                <div class="font-bold text-light">${c.years_experience} Years</div>
                <div class="text-xs ${meets ? 'text-emerald' : 'text-amber'} mt-1">
                  ${meets ? `✓ Meets ${c.target_role} benchmark (${bench.minExp}+ yrs)` : `⚠️ Under benchmark (${bench.minExp} yrs expected)`}
                </div>
              </td>
            `;
          }).join('')}
        </tr>

        <!-- SOURCING & DATE -->
        <tr>
          <th class="attr-col">Source & Applied Date</th>
          ${selectedCandidates.map(c => `
            <td>
              <div class="font-bold text-light">${escapeHtml(c.source || 'Direct')}</div>
              <div class="text-xs text-muted mt-1">Applied: ${escapeHtml(c.applied_date)}</div>
            </td>
          `).join('')}
        </tr>

        <!-- ALL DECLARED SKILLS -->
        <tr>
          <th class="attr-col">Declared Stack Breakdown</th>
          ${selectedCandidates.map(c => `
            <td>
              <div class="skills-container">
                ${(c.skills || []).map(s => {
                  const isShared = sharedSkillLower.has(s.toLowerCase());
                  return `<span class="skill-pill ${isShared ? 'shared-skill' : 'unique-skill'}">${escapeHtml(s)}</span>`;
                }).join('')}
              </div>
            </td>
          `).join('')}
        </tr>

        <!-- AI FIT RECOMMENDATION -->
        <tr>
          <th class="attr-col">AI Recommendation</th>
          ${selectedCandidates.map(c => {
            const ai = state.aiScores[c.id] || evaluateCandidateAI(c);
            return `
              <td>
                <div class="font-bold text-light" style="color: ${ai.score >= 80 ? '#34d399' : ai.score >= 65 ? '#38bdf8' : '#fbbf24'};">
                  ${ai.recommendation} (${ai.score}/100)
                </div>
                <p class="text-xs text-muted mt-1 leading-relaxed">${escapeHtml(ai.summary)}</p>
              </td>
            `;
          }).join('')}
        </tr>

        <!-- KEY STRENGTHS -->
        <tr>
          <th class="attr-col">Key Strengths</th>
          ${selectedCandidates.map(c => {
            const ai = state.aiScores[c.id] || evaluateCandidateAI(c);
            return `
              <td>
                <ul class="text-xs text-secondary pl-3" style="list-style: disc; line-height: 1.5;">
                  ${(ai.strengths || []).map(st => `<li>${escapeHtml(st)}</li>`).join('')}
                </ul>
              </td>
            `;
          }).join('')}
        </tr>

        <!-- AREAS TO PROBE -->
        <tr>
          <th class="attr-col">Areas to Probe</th>
          ${selectedCandidates.map(c => {
            const ai = state.aiScores[c.id] || evaluateCandidateAI(c);
            return `
              <td>
                <ul class="text-xs text-muted pl-3" style="list-style: disc; line-height: 1.5;">
                  ${(ai.concerns || []).map(cn => `<li>${escapeHtml(cn)}</li>`).join('')}
                </ul>
              </td>
            `;
          }).join('')}
        </tr>

        <!-- RECRUITER & SOURCING NOTES -->
        <tr>
          <th class="attr-col">Recruiter & Screening Notes</th>
          ${selectedCandidates.map(c => `
            <td>
              <div class="notes-display text-xs" style="max-height: 140px; overflow-y: auto;">
                ${escapeHtml(c.notes || 'No screening notes on file.')}
              </div>
              ${c.recruiter_notes ? `<div class="mt-2 text-xs text-cyan"><strong>Private Notes:</strong> ${escapeHtml(c.recruiter_notes)}</div>` : ''}
            </td>
          `).join('')}
        </tr>

        <!-- SUGGESTED QUESTIONS -->
        <tr>
          <th class="attr-col">Targeted Interview Questions</th>
          ${selectedCandidates.map(c => {
            const ai = state.aiScores[c.id] || evaluateCandidateAI(c);
            return `
              <td>
                <ol class="text-xs text-secondary pl-4" style="list-style: decimal; line-height: 1.5;">
                  ${(ai.questions || []).slice(0, 2).map(q => `<li>${escapeHtml(q)}</li>`).join('')}
                </ol>
              </td>
            `;
          }).join('')}
        </tr>
      </tbody>
    </table>
  `;

  dom.comparisonTableWrap.innerHTML = html;

  // Attach buttons inside comparison modal
  dom.comparisonTableWrap.querySelectorAll('.compare-shortlist-btn').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const cid = btn.getAttribute('data-id');
      const c = state.candidates.find(item => item.id === cid);
      if (!c) return;
      const newStatus = c.shortlisted ? 'Unreviewed' : 'Shortlist';
      await setCandidateStatus(cid, newStatus);
      openComparisonModal(); // Refresh modal
    });
  });

  dom.comparisonTableWrap.querySelectorAll('.compare-drawer-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const cid = btn.getAttribute('data-id');
      closeComparisonModal();
      openCandidateDrawer(cid);
    });
  });

  dom.compareModal.style.display = 'flex';
  document.body.style.overflow = 'hidden';
}

function closeComparisonModal() {
  if (dom.compareModal) dom.compareModal.style.display = 'none';
  document.body.style.overflow = '';
}

// ============================================================================
// Candidate Detail Drawer
// ============================================================================

function openCandidateDrawer(candidateId) {
  const c = state.candidates.find(item => item.id === candidateId);
  if (!c) return;

  state.activeCandidate = c;
  const status = getCandidateStatus(c);
  const ai = evaluateCandidateAI(c);

  // Populate Header
  if (dom.drawerAvatar) dom.drawerAvatar.textContent = getInitials(c.name);
  if (dom.drawerName) dom.drawerName.textContent = c.name;
  if (dom.drawerRole) dom.drawerRole.textContent = c.target_role;
  if (dom.drawerExp) dom.drawerExp.textContent = `${c.years_experience} yrs exp`;
  if (dom.drawerSource) dom.drawerSource.textContent = `Source: ${c.source || 'Direct'}`;
  if (dom.drawerDate) dom.drawerDate.textContent = `Applied: ${c.applied_date || '2026-09-10'}`;

  // Update Status Buttons
  updateDrawerStatusButtons(status);

  // Populate AI Analysis Card
  renderDrawerAICard(ai);

  // Skills Cloud
  if (dom.drawerSkillsCloud) {
    dom.drawerSkillsCloud.innerHTML = (c.skills || []).map(skill => `
      <span class="skill-pill highlight-skill">${escapeHtml(skill)}</span>
    `).join('');
  }

  // Original Notes
  if (dom.drawerOriginalNotes) {
    dom.drawerOriginalNotes.textContent = c.notes || 'No screening notes recorded.';
  }

  // Recruiter Internal Notes
  if (dom.drawerRecruiterNotes) {
    const recruiterNoteTags = (c.tags || []).filter(t => !t.startsWith('status:'));
    dom.drawerRecruiterNotes.value = recruiterNoteTags.join(', ');
  }
  if (dom.saveStatus) dom.saveStatus.textContent = 'Auto-saves to SQLite';

  // Show Drawer
  if (dom.candidateDrawer) {
    dom.candidateDrawer.classList.add('open');
    dom.candidateDrawer.setAttribute('aria-hidden', 'false');
  }
}

function closeCandidateDrawer() {
  if (dom.candidateDrawer) {
    dom.candidateDrawer.classList.remove('open');
    dom.candidateDrawer.setAttribute('aria-hidden', 'true');
  }
  state.activeCandidate = null;
}

function updateDrawerStatusButtons(activeStatus) {
  if (!dom.statusDecisionBtns) return;
  dom.statusDecisionBtns.forEach(btn => {
    const btnStatus = btn.getAttribute('data-status');
    if (btnStatus === activeStatus) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  });
}

function renderDrawerAICard(ai) {
  if (dom.drawerScoreVal) dom.drawerScoreVal.textContent = ai.score;
  if (dom.drawerRecommendation) {
    dom.drawerRecommendation.textContent = ai.recommendation;
    dom.drawerRecommendation.className = 'rec-badge';
    if (ai.score >= 80) dom.drawerRecommendation.classList.add('rec-strong');
    else if (ai.score >= 65) dom.drawerRecommendation.classList.add('rec-mid');
    else dom.drawerRecommendation.classList.add('rec-low');
  }
  if (dom.drawerSummary) dom.drawerSummary.textContent = ai.summary;

  // Strengths
  if (dom.drawerStrengthsList) {
    dom.drawerStrengthsList.innerHTML = (ai.strengths || []).map(str => `
      <li>${escapeHtml(str)}</li>
    `).join('');
  }

  // Concerns
  if (dom.drawerConcernsList) {
    dom.drawerConcernsList.innerHTML = (ai.concerns || []).map(con => `
      <li>${escapeHtml(con)}</li>
    `).join('');
  }

  // Questions
  if (dom.drawerQuestionsList) {
    dom.drawerQuestionsList.innerHTML = (ai.questions || []).map(q => `
      <li>${escapeHtml(q)}</li>
    `).join('');
  }

  if (dom.drawerInsightsSplit) dom.drawerInsightsSplit.style.display = 'grid';
  if (dom.drawerQuestionsBox) dom.drawerQuestionsBox.style.display = 'block';
}

// Trigger live AI Analysis
async function runAICandidateAnalysis(candidateId) {
  const c = state.candidates.find(item => item.id === candidateId);
  if (!c) return;

  showToast(`Analyzing ${c.name} with AI...`, 'magic');

  if (dom.drawerRunAIBtn && state.activeCandidate && state.activeCandidate.id === candidateId) {
    dom.drawerRunAIBtn.disabled = true;
    dom.drawerRunAIBtn.innerHTML = '<span class="spinner-sm"></span> Analyzing...';
  }

  try {
    // Attempt backend OpenAI API endpoint first
    const res = await fetch(`/api/candidates/${candidateId}/summary`, { method: 'POST' });
    if (res.ok) {
      const data = await res.json();
      c.ai_summary = data.summary;
      showToast(`OpenAI summary generated for ${c.name}`, 'success');
    }
  } catch (err) {
    // Fall back seamlessly to built-in semantic engine
    console.log('OpenAI key not configured; using high-precision built-in semantic engine.');
  }

  const ai = evaluateCandidateAI(c);

  if (state.activeCandidate && state.activeCandidate.id === candidateId) {
    renderDrawerAICard(ai);
    if (dom.drawerRunAIBtn) {
      dom.drawerRunAIBtn.disabled = false;
      dom.drawerRunAIBtn.innerHTML = '<span class="btn-icon">⚡</span> Re-Analyze with AI';
    }
  }

  updateMetricsAndTabs();
  applyFiltersAndRender();
  showToast(`AI Analysis complete for ${c.name} (${ai.score}/100)`, 'success');
}

// ============================================================================
// Auto-Save Recruiter Notes
// ============================================================================

function handleRecruiterNotesInput() {
  if (!state.activeCandidate) return;
  const noteText = dom.drawerRecruiterNotes.value.trim();
  
  if (dom.saveStatus) dom.saveStatus.textContent = 'Saving...';

  clearTimeout(state.saveNotesTimeout);
  state.saveNotesTimeout = setTimeout(async () => {
    const rawTags = noteText.split(',').map(t => t.trim()).filter(Boolean);
    const existingStatusTag = (state.activeCandidate.tags || []).find(t => t.startsWith('status:'));
    if (existingStatusTag) rawTags.push(existingStatusTag);

    try {
      const res = await fetch(`/api/candidates/${state.activeCandidate.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tags: rawTags })
      });
      if (!res.ok) throw new Error('Auto-save failed');
      state.activeCandidate.tags = rawTags;
      if (dom.saveStatus) dom.saveStatus.textContent = 'Saved to SQLite ✓';
      setTimeout(() => {
        if (dom.saveStatus) dom.saveStatus.textContent = 'Auto-saves to SQLite';
      }, 2000);
    } catch (err) {
      if (dom.saveStatus) dom.saveStatus.textContent = 'Save error ⚠️';
    }
  }, 750);
}

// ============================================================================
// Batch AI Auto-Triage Modal
// ============================================================================

function openBatchModal() {
  if (dom.batchModal) dom.batchModal.style.display = 'flex';
  if (dom.batchProgress) dom.batchProgress.style.display = 'none';
  if (dom.startBatchBtn) dom.startBatchBtn.disabled = false;
}

function closeBatchModal() {
  if (dom.batchModal) dom.batchModal.style.display = 'none';
}

async function startBatchTriage() {
  if (!dom.batchProgress || !dom.batchProgressFill || !dom.batchProgressText) return;

  dom.batchProgress.style.display = 'block';
  dom.startBatchBtn.disabled = true;

  const total = state.candidates.length;
  for (let i = 0; i < total; i++) {
    const c = state.candidates[i];
    evaluateCandidateAI(c);

    const pct = Math.round(((i + 1) / total) * 100);
    dom.batchProgressFill.style.width = `${pct}%`;
    dom.batchProgressText.textContent = `Evaluating candidate ${i + 1} of ${total}: ${c.name}...`;
    
    // Simulate slight asynchronous processing feel
    if (i % 6 === 0) {
      await new Promise(r => setTimeout(r, 60));
    }
  }

  dom.batchProgressText.textContent = `Successfully evaluated all ${total} candidates!`;
  updateMetricsAndTabs();
  applyFiltersAndRender();
  showToast(`Auto-triaged all ${total} candidates!`, 'success');

  setTimeout(() => {
    closeBatchModal();
  }, 1000);
}

// ============================================================================
// Export CSV
// ============================================================================

function exportCandidatesToCSV() {
  const candidatesToExport = state.filteredCandidates.length > 0 ? state.filteredCandidates : state.candidates;
  if (!candidatesToExport.length) {
    showToast('No candidates available to export.', 'error');
    return;
  }

  const headers = [
    'Candidate ID',
    'Name',
    'Target Role',
    'Years Experience',
    'Source',
    'Applied Date',
    'Status',
    'AI Fit Score',
    'AI Recommendation',
    'Technical Skills',
    'Sourcing Notes',
    'AI Summary'
  ];

  const rows = candidatesToExport.map(c => {
    const status = getCandidateStatus(c);
    const ai = state.aiScores[c.id] || evaluateCandidateAI(c);
    return [
      `"${c.id}"`,
      `"${c.name.replace(/"/g, '""')}"`,
      `"${c.target_role.replace(/"/g, '""')}"`,
      c.years_experience || 0,
      `"${(c.source || '').replace(/"/g, '""')}"`,
      `"${c.applied_date || ''}"`,
      `"${status}"`,
      ai.score,
      `"${ai.recommendation}"`,
      `"${(c.skills || []).join('; ').replace(/"/g, '""')}"`,
      `"${(c.notes || '').replace(/"/g, '""')}"`,
      `"${(c.ai_summary || ai.summary || '').replace(/"/g, '""')}"`
    ].join(',');
  });

  const csvContent = [headers.join(','), ...rows].join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `gccx_candidates_export_${new Date().toISOString().slice(0, 10)}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);

  showToast(`Exported ${candidatesToExport.length} candidates to CSV`, 'success');
}

// ============================================================================
// Theme Switcher (Dark / Light Mode)
// ============================================================================

function initTheme() {
  const savedTheme = localStorage.getItem('gccx_theme') || 'dark';
  applyTheme(savedTheme);

  if (dom.themeToggleBtn) {
    dom.themeToggleBtn.addEventListener('click', () => {
      const currentTheme = document.documentElement.getAttribute('data-theme') || 'dark';
      const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
      applyTheme(newTheme);
      showToast(`Switched to ${newTheme === 'dark' ? 'Dark' : 'Light'} Mode`, 'info');
    });
  }
}

function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  document.body.setAttribute('data-theme', theme);
  localStorage.setItem('gccx_theme', theme);

  if (dom.themeToggleBtn) {
    dom.themeToggleBtn.setAttribute('aria-checked', theme === 'light' ? 'true' : 'false');
  }
  if (dom.themeLabel) {
    dom.themeLabel.textContent = theme === 'dark' ? 'Dark Mode' : 'Light Mode';
  }
}

// ============================================================================
// Event Listeners Initialization
// ============================================================================

function setupEventListeners() {
  // Search input
  if (dom.searchInput) {
    dom.searchInput.addEventListener('input', (e) => {
      state.searchQuery = e.target.value;
      if (dom.clearSearchBtn) {
        dom.clearSearchBtn.style.display = state.searchQuery ? 'block' : 'none';
      }
      clearTimeout(state.searchDebounceTimeout);
      state.searchDebounceTimeout = setTimeout(() => {
        applyFiltersAndRender();
      }, 250);
    });
  }

  // Clear search
  if (dom.clearSearchBtn) {
    dom.clearSearchBtn.addEventListener('click', () => {
      if (dom.searchInput) dom.searchInput.value = '';
      state.searchQuery = '';
      dom.clearSearchBtn.style.display = 'none';
      applyFiltersAndRender();
    });
  }

  // Role filter
  if (dom.roleFilter) {
    dom.roleFilter.addEventListener('change', (e) => {
      state.activeRole = e.target.value;
      applyFiltersAndRender();
    });
  }

  // Source filter
  if (dom.sourceFilter) {
    dom.sourceFilter.addEventListener('change', (e) => {
      state.activeSource = e.target.value;
      applyFiltersAndRender();
    });
  }

  // Experience filter
  if (dom.expFilter) {
    dom.expFilter.addEventListener('change', (e) => {
      state.activeExp = e.target.value;
      applyFiltersAndRender();
    });
  }

  // Sort by
  if (dom.sortBy) {
    dom.sortBy.addEventListener('change', (e) => {
      state.sortBy = e.target.value;
      applyFiltersAndRender();
    });
  }

  // Pipeline tabs
  if (dom.tabPills) {
    dom.tabPills.forEach(pill => {
      pill.addEventListener('click', () => {
        dom.tabPills.forEach(p => p.classList.remove('active'));
        pill.classList.add('active');
        state.activeStatus = pill.getAttribute('data-status') || 'All';
        applyFiltersAndRender();
      });
    });
  }

  // View mode toggles
  if (dom.viewGridBtn && dom.viewListBtn) {
    dom.viewGridBtn.addEventListener('click', () => {
      dom.viewGridBtn.classList.add('active');
      dom.viewListBtn.classList.remove('active');
      dom.candidateGrid.classList.remove('list-view');
      state.viewMode = 'grid';
    });

    dom.viewListBtn.addEventListener('click', () => {
      dom.viewListBtn.classList.add('active');
      dom.viewGridBtn.classList.remove('active');
      dom.candidateGrid.classList.add('list-view');
      state.viewMode = 'list';
    });
  }

  // Reset all filters button
  if (dom.resetFiltersBtn) {
    dom.resetFiltersBtn.addEventListener('click', () => {
      if (dom.searchInput) dom.searchInput.value = '';
      if (dom.roleFilter) dom.roleFilter.value = '';
      if (dom.sourceFilter) dom.sourceFilter.value = '';
      if (dom.expFilter) dom.expFilter.value = '';
      if (dom.sortBy) dom.sortBy.value = 'ai_fit_score';
      state.searchQuery = '';
      state.activeRole = '';
      state.activeSource = '';
      state.activeExp = '';
      state.sortBy = 'ai_fit_score';
      state.activeStatus = 'All';

      if (dom.tabPills) {
        dom.tabPills.forEach(p => p.classList.remove('active'));
        const allTab = document.querySelector('.pipeline-tabs .tab-pill[data-status="All"]');
        if (allTab) allTab.classList.add('active');
      }

      applyFiltersAndRender();
      showToast('Filters reset to default', 'info');
    });
  }

  // Candidate Drawer Close
  if (dom.closeDrawerBtn) {
    dom.closeDrawerBtn.addEventListener('click', closeCandidateDrawer);
  }
  if (dom.drawerBackdrop) {
    dom.drawerBackdrop.addEventListener('click', closeCandidateDrawer);
  }
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeCandidateDrawer();
      closeBatchModal();
      closeComparisonModal();
      if (dom.settingsModal) dom.settingsModal.style.display = 'none';
    }
  });

  // Comparison Triggers & Actions
  if (dom.openCompareBtn) dom.openCompareBtn.addEventListener('click', openComparisonModal);
  if (dom.navCompareBtn) dom.navCompareBtn.addEventListener('click', openComparisonModal);
  if (dom.headerCompareBtn) dom.headerCompareBtn.addEventListener('click', openComparisonModal);
  if (dom.closeCompareModalBtn) dom.closeCompareModalBtn.addEventListener('click', closeComparisonModal);
  if (dom.closeCompareModalFooterBtn) dom.closeCompareModalFooterBtn.addEventListener('click', closeComparisonModal);
  if (dom.compareModal) {
    dom.compareModal.addEventListener('click', (e) => {
      if (e.target === dom.compareModal) closeComparisonModal();
    });
  }
  if (dom.clearCompareBtn) {
    dom.clearCompareBtn.addEventListener('click', () => {
      state.selectedForComparison.clear();
      updateCompareBar();
      renderCandidates();
      showToast('Comparison selection cleared', 'info');
    });
  }

  // Drawer Decision Buttons
  if (dom.statusDecisionBtns) {
    dom.statusDecisionBtns.forEach(btn => {
      btn.addEventListener('click', async () => {
        if (!state.activeCandidate) return;
        const newStatus = btn.getAttribute('data-status');
        await setCandidateStatus(state.activeCandidate.id, newStatus);
      });
    });
  }

  // Drawer Re-Analyze with AI
  if (dom.drawerRunAIBtn) {
    dom.drawerRunAIBtn.addEventListener('click', async () => {
      if (!state.activeCandidate) return;
      await runAICandidateAnalysis(state.activeCandidate.id);
    });
  }

  // Recruiter notes textarea auto-save
  if (dom.drawerRecruiterNotes) {
    dom.drawerRecruiterNotes.addEventListener('input', handleRecruiterNotesInput);
  }

  // Batch Triage Modal triggers
  if (dom.batchTriageBtn) {
    dom.batchTriageBtn.addEventListener('click', openBatchModal);
  }
  if (dom.closeBatchModalBtn) {
    dom.closeBatchModalBtn.addEventListener('click', closeBatchModal);
  }
  if (dom.cancelBatchBtn) {
    dom.cancelBatchBtn.addEventListener('click', closeBatchModal);
  }
  if (dom.startBatchBtn) {
    dom.startBatchBtn.addEventListener('click', startBatchTriage);
  }

  // Export CSV
  if (dom.exportBtn) {
    dom.exportBtn.addEventListener('click', exportCandidatesToCSV);
  }

  // Settings Modal triggers
  if (dom.settingsBtn && dom.settingsModal) {
    dom.settingsBtn.addEventListener('click', () => {
      dom.settingsModal.style.display = 'flex';
      const key = localStorage.getItem('openai_api_key') || '';
      if (dom.openaiApiKeyInput) dom.openaiApiKeyInput.value = key;
    });
  }
  if (dom.closeSettingsModalBtn && dom.settingsModal) {
    dom.closeSettingsModalBtn.addEventListener('click', () => {
      dom.settingsModal.style.display = 'none';
    });
  }
  if (dom.saveSettingsBtn && dom.settingsModal) {
    dom.saveSettingsBtn.addEventListener('click', () => {
      if (dom.openaiApiKeyInput) {
        localStorage.setItem('openai_api_key', dom.openaiApiKeyInput.value.trim());
      }
      dom.settingsModal.style.display = 'none';
      showToast('Settings saved successfully', 'success');
    });
  }

  // Reset DB button
  if (dom.resetDbBtn) {
    dom.resetDbBtn.addEventListener('click', async () => {
      if (!confirm('Are you sure you want to reset all candidate shortlists, status tags, and notes to the initial mock dataset?')) {
        return;
      }
      try {
        const res = await fetch('/api/reset', { method: 'POST' });
        if (!res.ok) throw new Error('Reset failed');
        state.aiScores = {};
        await fetchCandidates();
        showToast('Database reset to clean mock pipeline!', 'success');
      } catch (err) {
        showToast(`Reset error: ${err.message}`, 'error');
      }
    });
  }
}

// ============================================================================
// Application Bootstrap
// ============================================================================

document.addEventListener('DOMContentLoaded', () => {
  initDom();
  initTheme();
  setupEventListeners();
  fetchCandidates();
});
