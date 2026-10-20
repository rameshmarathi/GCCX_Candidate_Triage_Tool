/**
 * GCCX Candidate Triage Tool — Client Application Logic
 * Pure vanilla JavaScript with zero external runtime dependencies.
 */

// ==========================================================================
// Application State
// ==========================================================================

const state = {
  candidates: [],
  total: 0,
  roles: [],
  sources: [],
  allSkills: [],
  selectedForComparison: new Set(),
  activeDetailCandidate: null,
  activeSkillFilter: '',
  debounceTimer: null,
  isInitialLoad: true,
};

// Top popular tech skills for quick filter chips
const POPULAR_SKILLS = [
  'Python', 'React', 'Docker', 'Kubernetes', 'FastAPI',
  'Next.js', 'Go', 'Spring Boot', 'PostgreSQL', 'Terraform'
];

// ==========================================================================
// DOM Element Selectors
// ==========================================================================

const $ = (id) => document.getElementById(id);

const dom = {
  // Filters
  searchInput: $('search-input'),
  roleSelect: $('role-select'),
  experienceSelect: $('experience-select'),
  sourceSelect: $('source-select'),
  statusSelect: $('status-select'),
  sortSelect: $('sort-select'),
  skillInput: $('skill-input'),
  resetFiltersBtn: $('reset-filters-btn'),
  quickSkillsContainer: $('quick-skills-container'),
  emptyResetBtn: $('empty-reset-btn'),

  // Displays
  candidateList: $('candidate-list'),
  emptyState: $('empty-state'),
  totalCount: $('total-visible-count'),
  shortlistedCount: $('shortlisted-count'),
  aiStatusBadge: $('ai-status-badge'),
  aiStatusText: $('ai-status-text'),
  toastContainer: $('toast-container'),

  // Comparison Drawer
  compareBar: $('compare-bar'),
  compareCount: $('compare-count'),
  openCompareBtn: $('open-compare-btn'),
  clearCompareBtn: $('clear-compare-btn'),
  compareModal: $('compare-modal'),
  compareCloseBtn: $('compare-close-btn'),
  compareModalCloseAction: $('compare-modal-close-action'),
  comparisonTableWrap: $('comparison-table-wrap'),

  // Detail Modal
  detailModal: $('detail-modal'),
  detailCloseBtn: $('detail-close-btn'),
  detailModalCloseAction: $('detail-modal-close-action'),
  detailAvatar: $('detail-avatar'),
  detailName: $('detail-name'),
  detailRole: $('detail-role'),
  detailExp: $('detail-exp'),
  detailShortlistBadge: $('detail-shortlist-badge'),
  detailSource: $('detail-source'),
  detailDate: $('detail-date'),
  detailId: $('detail-id'),
  detailNotes: $('detail-notes'),
  detailSkills: $('detail-skills'),
  detailTagsList: $('detail-tags-list'),
  detailTagInput: $('detail-tag-input'),
  detailAddTagBtn: $('detail-add-tag-btn'),
  detailAiSummary: $('detail-ai-summary'),
  detailGenerateAiBtn: $('detail-generate-ai-btn'),
  detailAiBtnText: $('detail-ai-btn-text'),
  detailToggleShortlistBtn: $('detail-toggle-shortlist-btn'),

  // Export
  exportShortlistBtn: $('export-shortlist-btn'),
};

// ==========================================================================
// Utility Helpers
// ==========================================================================

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
    .map((word) => word[0])
    .join('')
    .toUpperCase() || 'C';
}

function showToast(message, type = 'info') {
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  
  let icon = 'ℹ️';
  if (type === 'success') icon = '✅';
  if (type === 'error') icon = '⚠️';

  toast.innerHTML = `<span>${icon}</span><span>${escapeHtml(message)}</span>`;
  dom.toastContainer.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(40px)';
    toast.style.transition = 'all 0.25s ease';
    setTimeout(() => toast.remove(), 250);
  }, 4000);
}

// ==========================================================================
// API Interaction & Candidate Loading
// ==========================================================================

async function fetchCandidates() {
  const params = new URLSearchParams();

  const q = dom.searchInput.value.trim();
  if (q) params.set('q', q);

  const role = dom.roleSelect.value;
  if (role) params.set('role', role);

  const source = dom.sourceSelect.value;
  if (source) params.set('source', source);

  const status = dom.statusSelect.value;
  if (status) params.set('shortlisted', status);

  const sort = dom.sortSelect.value;
  if (sort && sort !== 'default') params.set('sort', sort);

  const skill = (state.activeSkillFilter || dom.skillInput.value).trim();
  if (skill) params.set('skill', skill);

  const expValue = dom.experienceSelect.value;
  if (expValue === 'junior') {
    params.set('min_exp', '0');
    params.set('max_exp', '2');
  } else if (expValue === 'mid') {
    params.set('min_exp', '3');
    params.set('max_exp', '5');
  } else if (expValue === 'senior') {
    params.set('min_exp', '6');
    params.set('max_exp', '20');
  }

  try {
    const res = await fetch(`/api/candidates?${params.toString()}`);
    if (!res.ok) throw new Error(`HTTP Error: ${res.status}`);
    const data = await res.json();

    state.candidates = data.candidates;
    state.total = data.total;
    state.roles = data.roles || [];
    state.sources = data.sources || [];
    state.allSkills = data.all_skills || [];

    // Populate dropdown options on first load
    if (state.isInitialLoad) {
      populateDropdowns();
      renderQuickSkillChips();
      state.isInitialLoad = false;
    }

    renderCandidates();
    updateStats();

  } catch (err) {
    console.error('Error fetching candidates:', err);
    showToast('Failed to load candidates from API', 'error');
  }
}

function scheduleLoad() {
  clearTimeout(state.debounceTimer);
  state.debounceTimer = setTimeout(fetchCandidates, 180);
}

function populateDropdowns() {
  const currentRole = dom.roleSelect.value;
  const currentSource = dom.sourceSelect.value;

  dom.roleSelect.innerHTML = '<option value="">All Roles</option>' +
    state.roles.map(r => `<option value="${escapeHtml(r)}">${escapeHtml(r)}</option>`).join('');
  dom.roleSelect.value = currentRole;

  dom.sourceSelect.innerHTML = '<option value="">All Sources</option>' +
    state.sources.map(s => `<option value="${escapeHtml(s)}">${escapeHtml(s)}</option>`).join('');
  dom.sourceSelect.value = currentSource;
}

function renderQuickSkillChips() {
  dom.quickSkillsContainer.innerHTML = POPULAR_SKILLS.map((skill) => {
    const isActive = state.activeSkillFilter.toLowerCase() === skill.toLowerCase();
    return `<button class="skill-chip-filter ${isActive ? 'active' : ''}" data-skill="${escapeHtml(skill)}">${escapeHtml(skill)}</button>`;
  }).join('');
}

function updateStats() {
  dom.totalCount.textContent = state.total;
  const shortlistedCount = state.candidates.filter(c => c.shortlisted).length;
  dom.shortlistedCount.textContent = shortlistedCount;
}

// ==========================================================================
// Candidate Card Rendering
// ==========================================================================

function createCandidateCard(c) {
  const initials = getInitials(c.name);
  const isCompared = state.selectedForComparison.has(c.id);

  // Skill tags (clickable to filter)
  const skillsHtml = (c.skills || []).map(skill =>
    `<span class="skill-tag" data-action="filter-skill" data-skill="${escapeHtml(skill)}" title="Click to filter by ${escapeHtml(skill)}">${escapeHtml(skill)}</span>`
  ).join('');

  // Custom Recruiter Tags
  const tagsHtml = (c.tags || []).map(tag =>
    `<span class="recruiter-tag">
      <span>${escapeHtml(tag)}</span>
      <button class="tag-delete-btn" data-action="delete-tag" data-tag="${escapeHtml(tag)}" title="Remove tag">&times;</button>
    </span>`
  ).join('');

  // AI Fit Summary Snippet (if available)
  const aiSummaryHtml = c.ai_summary ? `
    <div class="card-ai-summary">
      <div class="card-ai-header">
        <span>✨ AI Fit Summary (gpt-4o-mini)</span>
      </div>
      <p>${escapeHtml(c.ai_summary)}</p>
    </div>
  ` : '';

  return `
    <article class="candidate-card ${c.shortlisted ? 'is-shortlisted' : ''}" data-id="${escapeHtml(c.id)}">
      <!-- Card Header -->
      <div class="card-header">
        <div class="avatar">${escapeHtml(initials)}</div>
        <div class="candidate-info">
          <div class="candidate-name-row">
            <span class="candidate-name" data-action="open-detail">${escapeHtml(c.name)}</span>
            <span class="badge-exp">${c.years_experience}y exp</span>
          </div>
          <div class="candidate-meta">
            <span class="badge-role">${escapeHtml(c.target_role)}</span>
            <span>•</span>
            <span>${escapeHtml(c.source)}</span>
            <span>•</span>
            <span>Applied ${escapeHtml(c.applied_date)}</span>
          </div>
        </div>
        <button class="btn btn-sm ${c.shortlisted ? 'btn-gold' : 'btn-secondary'}" data-action="toggle-shortlist" title="${c.shortlisted ? 'Remove from shortlist' : 'Add to shortlist'}">
          ${c.shortlisted ? '⭐ Shortlisted' : '☆ Shortlist'}
        </button>
      </div>

      <!-- Skills -->
      <div class="skills-wrap">
        ${skillsHtml}
      </div>

      <!-- Notes Snippet -->
      <div class="card-notes" data-action="open-detail" style="cursor:pointer;" title="Click to view full notes">
        ${escapeHtml(c.notes || 'No interview notes provided.')}
      </div>

      <!-- Custom Tags -->
      ${tagsHtml ? `<div class="card-tags">${tagsHtml}</div>` : ''}

      <!-- AI Evidence Summary -->
      ${aiSummaryHtml}

      <!-- Bottom Card Actions -->
      <div class="card-actions">
        <label class="compare-checkbox-label" title="Select to compare side-by-side (max 3)">
          <input type="checkbox" data-action="toggle-compare" ${isCompared ? 'checked' : ''}>
          <span>Compare</span>
        </label>

        <div class="actions-right">
          <button class="btn btn-secondary btn-sm" data-action="open-detail">
            View Profile
          </button>
          <button class="btn ${c.ai_summary ? 'btn-secondary' : 'btn-accent'} btn-sm" data-action="generate-ai" title="Call real OpenAI API for factual evidence summary">
            ${c.ai_summary ? 'Regen AI' : '✨ AI Summary'}
          </button>
        </div>
      </div>
    </article>
  `;
}

function renderCandidates() {
  if (state.candidates.length === 0) {
    dom.candidateList.innerHTML = '';
    dom.emptyState.classList.remove('hidden');
    return;
  }

  dom.emptyState.classList.add('hidden');
  dom.candidateList.innerHTML = state.candidates.map(createCandidateCard).join('');
}

// ==========================================================================
// Candidate Detail View / Modal
// ==========================================================================

function openDetailModal(candidateId) {
  const candidate = state.candidates.find(c => c.id === candidateId);
  if (!candidate) return;

  state.activeDetailCandidate = candidate;

  // Set Profile Header
  dom.detailAvatar.textContent = getInitials(candidate.name);
  dom.detailName.textContent = candidate.name;
  dom.detailRole.textContent = candidate.target_role;
  dom.detailExp.textContent = `${candidate.years_experience} years experience`;
  dom.detailSource.textContent = `Source: ${candidate.source}`;
  dom.detailDate.textContent = `Applied: ${candidate.applied_date}`;
  dom.detailId.textContent = `ID: ${candidate.id}`;

  // Shortlist badge & footer button
  updateDetailShortlistDisplay(candidate.shortlisted);

  // Notes & Skills
  dom.detailNotes.textContent = candidate.notes || 'No notes provided on this candidate profile.';
  dom.detailSkills.innerHTML = (candidate.skills || []).map(skill =>
    `<span class="skill-tag">${escapeHtml(skill)}</span>`
  ).join('');

  // Render Tags
  renderDetailTags();

  // Render AI Fit Summary
  renderDetailAiSummary();

  // Show Modal
  dom.detailModal.classList.remove('hidden');
  document.body.style.overflow = 'hidden';
}

function updateDetailShortlistDisplay(isShortlisted) {
  if (isShortlisted) {
    dom.detailShortlistBadge.className = 'badge-status badge-warning';
    dom.detailShortlistBadge.innerHTML = '<span class="status-dot"></span> Shortlisted';
    dom.detailToggleShortlistBtn.className = 'btn btn-secondary';
    dom.detailToggleShortlistBtn.textContent = 'Remove from Shortlist';
  } else {
    dom.detailShortlistBadge.className = 'badge-status badge-neutral';
    dom.detailShortlistBadge.innerHTML = '<span class="status-dot"></span> In Review';
    dom.detailToggleShortlistBtn.className = 'btn btn-primary';
    dom.detailToggleShortlistBtn.textContent = '⭐ Shortlist Candidate';
  }
}

function renderDetailTags() {
  const tags = state.activeDetailCandidate?.tags || [];
  if (tags.length === 0) {
    dom.detailTagsList.innerHTML = '<span class="text-muted" style="font-size:12px;">No custom tags added yet.</span>';
    return;
  }

  dom.detailTagsList.innerHTML = tags.map(tag => `
    <span class="recruiter-tag">
      <span>${escapeHtml(tag)}</span>
      <button class="tag-delete-btn" data-action="detail-delete-tag" data-tag="${escapeHtml(tag)}">&times;</button>
    </span>
  `).join('');
}

function renderDetailAiSummary() {
  const summary = state.activeDetailCandidate?.ai_summary;
  if (summary) {
    dom.detailAiSummary.innerHTML = `
      <div style="font-weight:700; color:var(--color-accent); font-size:12px; margin-bottom:6px;">
        Evidence Fit Summary:
      </div>
      <p style="font-size:13.5px; line-height:1.5;">${escapeHtml(summary)}</p>
    `;
    dom.detailAiBtnText.textContent = 'Regenerate Summary';
  } else {
    dom.detailAiSummary.innerHTML = `
      <p class="ai-empty-notice">No AI summary generated yet. Click "Generate AI Summary" above to call the OpenAI API with this candidate's target role, experience, skills, and notes.</p>
    `;
    dom.detailAiBtnText.textContent = 'Generate AI Summary';
  }
}

function closeDetailModal() {
  dom.detailModal.classList.add('hidden');
  state.activeDetailCandidate = null;
  document.body.style.overflow = '';
}

// ==========================================================================
// Candidate Shortlist & Tag Management Actions
// ==========================================================================

async function toggleCandidateShortlist(candidateId, newStatus) {
  try {
    const res = await fetch(`/api/candidates/${encodeURIComponent(candidateId)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ shortlisted: newStatus })
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to update shortlist status');
    }

    const data = await res.json();
    const updated = data.candidate;

    // Update in local state
    const target = state.candidates.find(c => c.id === candidateId);
    if (target) target.shortlisted = updated.shortlisted;

    // If detail modal is currently showing this candidate
    if (state.activeDetailCandidate && state.activeDetailCandidate.id === candidateId) {
      state.activeDetailCandidate.shortlisted = updated.shortlisted;
      updateDetailShortlistDisplay(updated.shortlisted);
    }

    renderCandidates();
    updateStats();
    showToast(`${updated.name} ${updated.shortlisted ? 'shortlisted' : 'removed from shortlist'}.`, 'success');

  } catch (err) {
    console.error('Error toggling shortlist:', err);
    showToast(err.message, 'error');
  }
}

async function addCandidateTag(candidateId, newTag) {
  const clean = newTag.trim();
  if (!clean) return;

  const candidate = state.candidates.find(c => c.id === candidateId);
  if (!candidate) return;

  const currentTags = candidate.tags || [];
  if (currentTags.includes(clean)) {
    showToast(`Tag "${clean}" already exists on candidate.`, 'info');
    return;
  }

  const updatedTags = [...currentTags, clean];

  try {
    const res = await fetch(`/api/candidates/${encodeURIComponent(candidateId)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tags: updatedTags })
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to add tag');
    }

    const data = await res.json();
    candidate.tags = data.candidate.tags;

    if (state.activeDetailCandidate && state.activeDetailCandidate.id === candidateId) {
      state.activeDetailCandidate.tags = data.candidate.tags;
      renderDetailTags();
    }

    renderCandidates();
    showToast(`Tag "${clean}" added.`, 'success');

  } catch (err) {
    console.error('Error adding tag:', err);
    showToast(err.message, 'error');
  }
}

async function removeCandidateTag(candidateId, tagToRemove) {
  const candidate = state.candidates.find(c => c.id === candidateId);
  if (!candidate) return;

  const updatedTags = (candidate.tags || []).filter(t => t !== tagToRemove);

  try {
    const res = await fetch(`/api/candidates/${encodeURIComponent(candidateId)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tags: updatedTags })
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to remove tag');
    }

    const data = await res.json();
    candidate.tags = data.candidate.tags;

    if (state.activeDetailCandidate && state.activeDetailCandidate.id === candidateId) {
      state.activeDetailCandidate.tags = data.candidate.tags;
      renderDetailTags();
    }

    renderCandidates();
    showToast(`Tag "${tagToRemove}" removed.`, 'info');

  } catch (err) {
    console.error('Error removing tag:', err);
    showToast(err.message, 'error');
  }
}

// ==========================================================================
// Genuine AI Summary Generation
// ==========================================================================

async function generateAISummary(candidateId, triggerBtn = null) {
  const candidate = state.candidates.find(c => c.id === candidateId);
  if (!candidate) return;

  if (triggerBtn) {
    triggerBtn.disabled = true;
    triggerBtn.textContent = 'Contacting OpenAI...';
  }
  if (dom.detailGenerateAiBtn && state.activeDetailCandidate?.id === candidateId) {
    dom.detailGenerateAiBtn.disabled = true;
    dom.detailAiBtnText.textContent = 'Contacting OpenAI...';
  }

  showToast(`Generating AI fit summary for ${candidate.name}...`, 'info');

  try {
    const res = await fetch(`/api/candidates/${encodeURIComponent(candidateId)}/summary`, {
      method: 'POST'
    });

    const data = await res.json();

    if (res.status === 503) {
      throw new Error(data.error || 'OPENAI_API_KEY is not configured in the environment.');
    }

    if (!res.ok) {
      throw new Error(data.error || 'AI summary generation failed.');
    }

    // Success: store generated summary
    candidate.ai_summary = data.summary;

    if (state.activeDetailCandidate && state.activeDetailCandidate.id === candidateId) {
      state.activeDetailCandidate.ai_summary = data.summary;
      renderDetailAiSummary();
    }

    renderCandidates();
    showToast(`AI evidence summary generated with ${data.model}!`, 'success');

  } catch (err) {
    console.error('AI summary error:', err);
    showToast(err.message, 'error');
  } finally {
    if (triggerBtn) {
      triggerBtn.disabled = false;
      triggerBtn.textContent = candidate.ai_summary ? 'Regen AI' : '✨ AI Summary';
    }
    if (dom.detailGenerateAiBtn && state.activeDetailCandidate?.id === candidateId) {
      dom.detailGenerateAiBtn.disabled = false;
      dom.detailAiBtnText.textContent = candidate.ai_summary ? 'Regenerate Summary' : 'Generate AI Summary';
    }
  }
}

// ==========================================================================
// Candidate Comparison Feature
// ==========================================================================

function toggleCandidateCompare(candidateId) {
  if (state.selectedForComparison.has(candidateId)) {
    state.selectedForComparison.delete(candidateId);
  } else {
    if (state.selectedForComparison.size >= 3) {
      showToast('You can compare a maximum of 3 candidates simultaneously.', 'info');
      renderCandidates();
      return;
    }
    state.selectedForComparison.add(candidateId);
  }

  updateCompareBar();
  renderCandidates();
}

function updateCompareBar() {
  const count = state.selectedForComparison.size;
  dom.compareCount.textContent = count;

  if (count > 0) {
    dom.compareBar.classList.remove('hidden');
  } else {
    dom.compareBar.classList.add('hidden');
  }
}

function openComparisonModal() {
  const ids = Array.from(state.selectedForComparison);
  const selectedCandidates = state.candidates.filter(c => ids.includes(c.id));

  if (selectedCandidates.length < 2) {
    showToast('Select at least 2 candidates to compare side-by-side.', 'info');
    return;
  }

  // Calculate shared skills across selected candidates
  const allSkillArrays = selectedCandidates.map(c => new Set(c.skills || []));
  const sharedSkills = selectedCandidates[0].skills.filter(s =>
    allSkillArrays.every(set => set.has(s))
  );

  let html = `
    <table class="compare-table">
      <thead>
        <tr>
          <th>Attribute</th>
          ${selectedCandidates.map(c => `
            <th class="compare-candidate-col">
              <div class="compare-cand-name">${escapeHtml(c.name)}</div>
              <span class="badge-role">${escapeHtml(c.target_role)}</span>
            </th>
          `).join('')}
        </tr>
      </thead>
      <tbody>
        <tr>
          <th>Experience</th>
          ${selectedCandidates.map(c => `<td><strong>${c.years_experience} years</strong></td>`).join('')}
        </tr>
        <tr>
          <th>Source</th>
          ${selectedCandidates.map(c => `<td>${escapeHtml(c.source)}</td>`).join('')}
        </tr>
        <tr>
          <th>Applied Date</th>
          ${selectedCandidates.map(c => `<td>${escapeHtml(c.applied_date)}</td>`).join('')}
        </tr>
        <tr>
          <th>Shared Skills</th>
          <td colspan="${selectedCandidates.length}">
            ${sharedSkills.length ? sharedSkills.map(s => `<span class="skill-tag" style="background:#dcfce7; color:#15803d;">${escapeHtml(s)}</span>`).join(' ') : '<span class="text-muted">No shared skills across all selected profiles.</span>'}
          </td>
        </tr>
        <tr>
          <th>All Skills</th>
          ${selectedCandidates.map(c => `
            <td>
              <div class="skills-wrap">
                ${(c.skills || []).map(s => `<span class="skill-tag">${escapeHtml(s)}</span>`).join('')}
              </div>
            </td>
          `).join('')}
        </tr>
        <tr>
          <th>Recruiter Notes</th>
          ${selectedCandidates.map(c => `
            <td><div class="card-notes">${escapeHtml(c.notes || 'None')}</div></td>
          `).join('')}
        </tr>
        <tr>
          <th>Recruiter Tags</th>
          ${selectedCandidates.map(c => `
            <td>
              <div class="card-tags">
                ${(c.tags || []).map(t => `<span class="recruiter-tag"><span>${escapeHtml(t)}</span></span>`).join('') || '<span class="text-muted" style="font-size:12px;">No tags</span>'}
              </div>
            </td>
          `).join('')}
        </tr>
        <tr>
          <th>AI Fit Summary</th>
          ${selectedCandidates.map(c => `
            <td>
              ${c.ai_summary ? `<div class="card-ai-summary">${escapeHtml(c.ai_summary)}</div>` : `<span class="text-muted" style="font-size:12px;">No AI summary yet.</span>`}
            </td>
          `).join('')}
        </tr>
      </tbody>
    </table>
  `;

  dom.comparisonTableWrap.innerHTML = html;
  dom.compareModal.classList.remove('hidden');
  document.body.style.overflow = 'hidden';
}

function closeComparisonModal() {
  dom.compareModal.classList.add('hidden');
  document.body.style.overflow = '';
}

// ==========================================================================
// Export Shortlist Functionality
// ==========================================================================

function exportShortlist() {
  const shortlisted = state.candidates.filter(c => c.shortlisted);
  if (shortlisted.length === 0) {
    showToast('No candidates currently shortlisted to export.', 'info');
    return;
  }

  const headers = ['ID', 'Name', 'Target Role', 'Years Experience', 'Source', 'Skills', 'Tags', 'AI Summary', 'Notes', 'Applied Date'];
  const rows = shortlisted.map(c => [
    `"${c.id}"`,
    `"${c.name.replace(/"/g, '""')}"`,
    `"${c.target_role.replace(/"/g, '""')}"`,
    c.years_experience,
    `"${c.source.replace(/"/g, '""')}"`,
    `"${(c.skills || []).join('; ')}"`,
    `"${(c.tags || []).join('; ')}"`,
    `"${(c.ai_summary || '').replace(/"/g, '""')}"`,
    `"${(c.notes || '').replace(/"/g, '""')}"`,
    `"${c.applied_date}"`
  ]);

  const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
  const encodedUri = encodeURI(csvContent);
  const link = document.createElement('a');
  link.setAttribute('href', encodedUri);
  link.setAttribute('download', `gccx_shortlist_${new Date().toISOString().slice(0, 10)}.csv`);
  document.body.appendChild(link);
  link.click();
  link.remove();

  showToast(`Exported ${shortlisted.length} shortlisted candidates to CSV.`, 'success');
}

// ==========================================================================
// Health & Environment Verification
// ==========================================================================

async function checkApiHealth() {
  try {
    const res = await fetch('/api/health');
    const data = await res.json();

    if (data.ai_configured) {
      dom.aiStatusBadge.className = 'badge-status badge-success';
      dom.aiStatusText.textContent = 'OpenAI API Connected';
    } else {
      dom.aiStatusBadge.className = 'badge-status badge-warning';
      dom.aiStatusText.textContent = 'OPENAI_API_KEY Not Set';
    }
  } catch (err) {
    dom.aiStatusBadge.className = 'badge-status badge-neutral';
    dom.aiStatusText.textContent = 'API Offline';
  }
}

// ==========================================================================
// Event Listeners & Wiring
// ==========================================================================

// Filter listeners
[dom.searchInput, dom.skillInput].forEach(input => {
  input.addEventListener('input', scheduleLoad);
});

[dom.roleSelect, dom.experienceSelect, dom.sourceSelect, dom.statusSelect, dom.sortSelect].forEach(select => {
  select.addEventListener('change', fetchCandidates);
});

// Reset filters button
function resetAllFilters() {
  dom.searchInput.value = '';
  dom.roleSelect.value = '';
  dom.experienceSelect.value = '';
  dom.sourceSelect.value = '';
  dom.statusSelect.value = '';
  dom.sortSelect.value = 'default';
  dom.skillInput.value = '';
  state.activeSkillFilter = '';

  document.querySelectorAll('.skill-chip-filter').forEach(btn => btn.classList.remove('active'));
  fetchCandidates();
  showToast('Filters reset to default.', 'info');
}

dom.resetFiltersBtn.addEventListener('click', resetAllFilters);
dom.emptyResetBtn.addEventListener('click', resetAllFilters);

// Quick skill chip filters click
dom.quickSkillsContainer.addEventListener('click', (e) => {
  const chip = e.target.closest('.skill-chip-filter');
  if (!chip) return;

  const skill = chip.dataset.skill;
  if (state.activeSkillFilter.toLowerCase() === skill.toLowerCase()) {
    state.activeSkillFilter = '';
    chip.classList.remove('active');
  } else {
    state.activeSkillFilter = skill;
    document.querySelectorAll('.skill-chip-filter').forEach(btn => btn.classList.remove('active'));
    chip.classList.add('active');
  }
  fetchCandidates();
});

// Candidate grid delegated actions (shortlist, detail, tags, compare, AI)
dom.candidateList.addEventListener('click', (e) => {
  const card = e.target.closest('.candidate-card');
  if (!card) return;
  const candidateId = card.dataset.id;
  const candidate = state.candidates.find(c => c.id === candidateId);
  if (!candidate) return;

  // Toggle Shortlist
  const shortlistBtn = e.target.closest('[data-action="toggle-shortlist"]');
  if (shortlistBtn) {
    toggleCandidateShortlist(candidateId, !candidate.shortlisted);
    return;
  }

  // Delete Tag
  const deleteTagBtn = e.target.closest('[data-action="delete-tag"]');
  if (deleteTagBtn) {
    const tag = deleteTagBtn.dataset.tag;
    removeCandidateTag(candidateId, tag);
    return;
  }

  // Filter by Skill clicked on card
  const filterSkillBtn = e.target.closest('[data-action="filter-skill"]');
  if (filterSkillBtn) {
    const skill = filterSkillBtn.dataset.skill;
    state.activeSkillFilter = skill;
    renderQuickSkillChips();
    fetchCandidates();
    showToast(`Filtering candidates with skill: ${skill}`, 'info');
    return;
  }

  // Toggle Compare Checkbox
  const compareCheck = e.target.closest('[data-action="toggle-compare"]');
  if (compareCheck) {
    toggleCandidateCompare(candidateId);
    return;
  }

  // Generate AI Summary from card
  const aiBtn = e.target.closest('[data-action="generate-ai"]');
  if (aiBtn) {
    generateAISummary(candidateId, aiBtn);
    return;
  }

  // Open Full Detail Modal
  const openDetailTrigger = e.target.closest('[data-action="open-detail"]');
  if (openDetailTrigger) {
    openDetailModal(candidateId);
    return;
  }
});

// Detail Modal Actions
dom.detailCloseBtn.addEventListener('click', closeDetailModal);
dom.detailModalCloseAction.addEventListener('click', closeDetailModal);

dom.detailModal.addEventListener('click', (e) => {
  if (e.target === dom.detailModal) closeDetailModal();
});

// Toggle shortlist from inside modal
dom.detailToggleShortlistBtn.addEventListener('click', () => {
  if (!state.activeDetailCandidate) return;
  toggleCandidateShortlist(state.activeDetailCandidate.id, !state.activeDetailCandidate.shortlisted);
});

// Add Tag from inside modal
dom.detailAddTagBtn.addEventListener('click', () => {
  if (!state.activeDetailCandidate) return;
  addCandidateTag(state.activeDetailCandidate.id, dom.detailTagInput.value);
  dom.detailTagInput.value = '';
});

dom.detailTagInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    e.preventDefault();
    dom.detailAddTagBtn.click();
  }
});

// Suggested tag chips inside modal
document.querySelectorAll('.chip-suggest').forEach(chip => {
  chip.addEventListener('click', () => {
    if (!state.activeDetailCandidate) return;
    addCandidateTag(state.activeDetailCandidate.id, chip.dataset.tag);
  });
});

// Delete tag inside modal
dom.detailTagsList.addEventListener('click', (e) => {
  const deleteBtn = e.target.closest('[data-action="detail-delete-tag"]');
  if (deleteBtn && state.activeDetailCandidate) {
    removeCandidateTag(state.activeDetailCandidate.id, deleteBtn.dataset.tag);
  }
});

// Generate AI summary inside modal
dom.detailGenerateAiBtn.addEventListener('click', () => {
  if (!state.activeDetailCandidate) return;
  generateAISummary(state.activeDetailCandidate.id);
});

// Comparison Modal Actions
dom.openCompareBtn.addEventListener('click', openComparisonModal);
dom.compareCloseBtn.addEventListener('click', closeComparisonModal);
dom.compareModalCloseAction.addEventListener('click', closeComparisonModal);
dom.compareModal.addEventListener('click', (e) => {
  if (e.target === dom.compareModal) closeComparisonModal();
});

dom.clearCompareBtn.addEventListener('click', () => {
  state.selectedForComparison.clear();
  updateCompareBar();
  renderCandidates();
  showToast('Comparison list cleared.', 'info');
});

// Export Shortlist
dom.exportShortlistBtn.addEventListener('click', exportShortlist);

// Global Keyboard shortcuts
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    closeDetailModal();
    closeComparisonModal();
  }
});

// ==========================================================================
// Initialization
// ==========================================================================

fetchCandidates();
checkApiHealth();
