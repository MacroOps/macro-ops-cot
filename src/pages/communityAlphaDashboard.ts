// @ts-nocheck
// Verbatim port of the <script> in community_alpha_dashboard_reference.html.
// Only changes: data and element handles are passed in, and the global keydown
// listener is removed on unmount. Rendering and behavior are unchanged.
export type DashboardEls = {
  dateList: HTMLElement;
  main: HTMLElement;
  search: HTMLInputElement;
  searchClear: HTMLElement;
};

export function mountDashboard(els: DashboardEls, data: { generated_at: string | null; days: unknown[] }): () => void {
  
  const days = (data.days || []).slice().sort((a, b) => b.date.localeCompare(a.date));

  const dateList = els.dateList;
  const main = els.main;
  const searchInput = els.search;
  const searchClear = els.searchClear;

  let activeDate = days.length ? days[0].date : null;
  let searchQuery = '';
  let lookbackPeriod = 'month'; // 'week' or 'month'
  let searchScope = null;      // null, 'week', or 'month' — limits search to last N weeks
  let hideTechnical = false;   // hide ideas flagged technical (chart/positioning-only)
  try { hideTechnical = sessionStorage.getItem('mo-tradeideas-hide-technical') === '1'; } catch (e) {}
  function shown(ideas) { return hideTechnical ? (ideas || []).filter(i => !i.technical) : (ideas || []); }
  function techCount(ideas) { return (ideas || []).filter(i => i.technical).length; }
  function techToggleHtml(n) {
    if (!n && !hideTechnical) return '';
    return '<button class="tech-toggle' + (hideTechnical ? ' on' : '') + '" type="button" id="tech-toggle" title="Technical = based only on charts, momentum or positioning">'
      + (hideTechnical ? 'Show technical calls' : 'Hide technical calls') + (n ? ' (' + n + ')' : '') + '</button>';
  }

  try {
    const saved = sessionStorage.getItem('mo-tradeideas-active-date');
    if (saved && days.find(d => d.date === saved)) activeDate = saved;
  } catch (e) {}

  function escapeHtml(str) {
    return String(str == null ? '' : str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function safeSlackUrl(url) {
    if (!url) return null;
    const raw = String(url).trim();
    if (!/^https:\/\//i.test(raw)) return null;
    try {
      const parsed = new URL(raw);
      if (parsed.protocol !== 'https:') return null;
      const host = parsed.hostname.toLowerCase();
      if (host !== 'slack.com' && !host.endsWith('.slack.com')) return null;
      return parsed.href;
    } catch (e) {
      return null;
    }
  }

  function highlight(text, query) {
    const escaped = escapeHtml(text);
    if (!query) return escaped;
    const safe = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return escaped.replace(new RegExp('(' + safe + ')', 'gi'), '<mark class="highlight">$1</mark>');
  }

  function ideaMatches(idea, query) {
    if (!query) return true;
    const q = query.toLowerCase();
    const haystack = [
      idea.channel_name, idea.author_name, idea.tickers,
      idea.direction, idea.label, idea.one_liner, idea.idea_type,
      idea.technical ? 'technical' : ''
    ].filter(Boolean).join(' ').toLowerCase();
    return haystack.includes(q);
  }

  function ideaClass(idea) {
    if (idea.idea_type === 'thesis') return 'thesis';
    const d = (idea.direction || '').toLowerCase();
    if (d === 'long' || d === 'buy' || d === 'bullish') return 'long';
    if (d === 'short' || d === 'bearish') return 'short';
    if (d === 'exit' || d === 'trim' || d === 'cover' || d === 'sell') return 'exit';
    return 'thesis';
  }

  function renderSidebar(query) {
    dateList.innerHTML = '';
    if (days.length === 0) {
      const li = document.createElement('li');
      li.style.cssText = 'padding: 10px 12px; color: hsl(var(--muted-foreground)); font-size: 12px; font-style: italic;';
      li.textContent = 'No data yet.';
      dateList.appendChild(li);
      return;
    }
    for (const day of days) {
      const matched = query ? shown(day.ideas).filter(i => ideaMatches(i, query)) : shown(day.ideas);
      const li = document.createElement('li');
      const btn = document.createElement('button');
      btn.className = 'date-btn';
      if (day.date === activeDate) btn.classList.add('active');
      if (query && matched.length === 0) btn.classList.add('no-matches');
      if (query && matched.length > 0) btn.classList.add('has-matches');

      const left = document.createElement('span');
      left.textContent = day.date;
      const right = document.createElement('span');
      right.className = 'date-count';
      right.textContent = matched.length;

      btn.appendChild(left);
      btn.appendChild(right);
      btn.addEventListener('click', () => {
        if (searchQuery) {
          const target = main.querySelector('#search-week-' + CSS.escape(day.date));
          if (target) {
            target.scrollIntoView({ behavior: 'smooth', block: 'start' });
            return;
          }
        }
        activeDate = day.date;
        try { sessionStorage.setItem('mo-tradeideas-active-date', activeDate); } catch (e) {}
        render();
      });
      li.appendChild(btn);
      dateList.appendChild(li);
    }
  }

  function lookbackWeeks(period) { return period === 'month' ? 4 : 1; }

  function computeTopTickers(period) {
    const n = lookbackWeeks(period);
    const recentDays = days.slice(0, n);
    const counts = {};
    for (const d of recentDays) {
      for (const idea of shown(d.ideas)) {
        if (!idea.tickers) continue;
        const list = idea.tickers.split(/[,/]+/).map(t => t.trim()).filter(Boolean);
        for (const t of list) {
          counts[t] = (counts[t] || 0) + 1;
        }
      }
    }
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .slice(0, 5)
      .map(([ticker, count]) => ({ ticker, count }));
  }

  function renderTopTickersRow() {
    const top = computeTopTickers(lookbackPeriod);
    let html = '<div class="top-tickers-row">';
    html += '<span class="top-tickers-label">Top tickers over the past</span>';
    html += '<select class="lookback-select" id="lookback-select" aria-label="Lookback period">';
    html += '<option value="week"' + (lookbackPeriod === 'week' ? ' selected' : '') + '>1 week</option>';
    html += '<option value="month"' + (lookbackPeriod === 'month' ? ' selected' : '') + '>1 month</option>';
    html += '</select>';
    if (top.length === 0) {
      html += '<span class="top-tickers-empty">No ticker mentions in window.</span>';
    } else {
      for (const t of top) {
        html += '<button class="ticker-pill" type="button" data-ticker="' + escapeHtml(t.ticker) + '" data-scope="' + lookbackPeriod + '" title="Search ' + escapeHtml(t.ticker) + ' over the past ' + (lookbackPeriod === 'week' ? '1 week' : '1 month') + '">';
        html += escapeHtml(t.ticker);
        html += '<span class="ticker-pill-count">' + t.count + '</span>';
        html += '</button>';
      }
    }
    html += '</div>';
    return html;
  }

  function renderChannelsForIdeas(ideas, query) {
    if (!ideas || ideas.length === 0) return '';
    const channelOrder = ['#ideas-equities', '#ideas-commodities', '#ideas-fx', '#ideas-rates', '#big-bet', '#emerging-markets', '#general', '#hedging'];
    const groups = {};
    const channelIds = {};
    for (const idea of ideas) {
      if (!groups[idea.channel_name]) groups[idea.channel_name] = [];
      groups[idea.channel_name].push(idea);
      channelIds[idea.channel_name] = idea.channel_id;
    }
    const channelsList = Object.keys(groups).sort((a, b) => {
      const ai = channelOrder.indexOf(a);
      const bi = channelOrder.indexOf(b);
      return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
    });
    let html = '';
    for (const ch of channelsList) {
      const chId = channelIds[ch];
      html += '<div class="channel">';
      html += '<h3><a href="https://comm-center.slack.com/archives/' + escapeHtml(chId) + '" target="_blank" rel="noopener">' + escapeHtml(ch) + '</a></h3>';
      for (const idea of groups[ch]) {
        const cls = ideaClass(idea);
        const tagText = idea.idea_type === 'thesis'
          ? 'Thesis'
          : (idea.direction || idea.idea_type || '');
        html += '<div class="idea ' + cls + '">';
        html += '<div class="row1">';
        if (tagText) {
          html += '<span class="tag ' + cls + '">' + escapeHtml(tagText) + '</span>';
        }
        if (idea.technical) {
          html += '<span class="tag technical" title="Based only on charts, momentum or positioning">Technical</span>';
        }
        if (idea.label) {
          html += highlight(idea.label, query);
        } else if (idea.tickers) {
          html += '<span class="ticker">' + highlight(idea.tickers, query) + '</span>';
        }
        html += '</div>';
        html += '<div class="row2"><span class="author">' + highlight(idea.author_name || '', query) + '</span>: ' + highlight(idea.one_liner || '', query);
        if (idea.permalink) {
          html += ' <a href="' + escapeHtml(idea.permalink) + '" target="_blank" rel="noopener">view in Slack</a>';
        }
        html += '</div>';
        html += '</div>';
      }
      html += '</div>';
    }
    return html;
  }

  function renderMain(day, query) {
    if (days.length === 0) {
      main.innerHTML = '<div class="empty-state"><div class="big">No weekly digests yet.</div>The first scheduled run is set for Friday at 2:05 PM PT. Check back after that.</div>';
      return;
    }

    // SEARCH MODE — show matching ideas (across all weeks, or scoped to lookback)
    if (query) {
      const candidateDays = searchScope
        ? days.slice(0, lookbackWeeks(searchScope))
        : days;
      const matchesByDay = candidateDays.map(d => ({
        day: d,
        matched: shown(d.ideas).filter(i => ideaMatches(i, query)),
        techHidden: hideTechnical ? d.ideas.filter(i => i.technical && ideaMatches(i, query)).length : 0,
        techMatched: d.ideas.filter(i => i.technical && ideaMatches(i, query)).length
      })).filter(x => x.matched.length > 0);

      const totalMatches = matchesByDay.reduce((s, x) => s + x.matched.length, 0);
      const techInSearch = candidateDays.reduce((s, d) => s + d.ideas.filter(i => i.technical && ideaMatches(i, query)).length, 0);

      let html = '';
      html += '<div class="main-header"><h2 class="day-title">Search</h2></div>';
      const scopeLabel = searchScope
        ? 'the past ' + (searchScope === 'week' ? '1 week' : '1 month')
        : 'all digests';
      html += '<div class="search-active-banner"><button class="banner-close" type="button" aria-label="Close search" title="Return to digest">&times; Close</button>Searching ' + scopeLabel + ' for <strong>"' + escapeHtml(query) + '"</strong>: ' + totalMatches + ' match' + (totalMatches === 1 ? '' : 'es') + ' across ' + matchesByDay.length + ' week' + (matchesByDay.length === 1 ? '' : 's') + '.</div>';
      const tt = techToggleHtml(techInSearch);
      if (tt) html += '<div class="summary-row">' + tt + '</div>';

      if (matchesByDay.length === 0) {
        html += '<div class="empty-state">No ideas match your search across any week.</div>';
      } else {
        for (const x of matchesByDay) {
          html += '<section class="search-week-section" id="search-week-' + escapeHtml(x.day.date) + '">';
          html += '<h3 class="search-week-heading">' + escapeHtml(x.day.date) + ' <span class="search-week-count">' + x.matched.length + ' match' + (x.matched.length === 1 ? '' : 'es') + '</span></h3>';
          html += renderChannelsForIdeas(x.matched, query);
          html += '</section>';
        }
      }

      html += '<div class="filter-footer"><strong>Filters applied:</strong> Macro Ops team (Alexander Barrow, Mike Gyulai, Brandon Beylo, Dean Christians, Tony Dundas-Lucca) is excluded. Tactical management updates (trims, profit-taking, exits without new thesis) are also filtered regardless of author. Ideas based only on charts, momentum or positioning are tagged <strong>Technical</strong> and can be hidden. Sourcing long-term community-member ideas only.</div>';

      main.innerHTML = html;
      return;
    }

    // SINGLE-DAY MODE
    if (!day) {
      main.innerHTML = '<div class="empty-state"><div class="big">No weekly digests yet.</div>The first scheduled run is set for Friday at 2:05 PM PT. Check back after that.</div>';
      return;
    }

    let html = '';
    html += '<div class="main-header">';
    html += '<h2 class="day-title">' + escapeHtml(day.date) + '</h2>';
    const win = day.window || {};
    const startIso = win.oldest_iso;
    const endIso = win.latest_iso || win.now_iso;
    if (startIso && endIso) {
      try {
        const fmt = { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: 'America/Los_Angeles' };
        const a = new Date(startIso).toLocaleString('en-US', fmt);
        const b = new Date(endIso).toLocaleString('en-US', fmt);
        html += '<span class="day-meta">Window: ' + escapeHtml(a) + ' &rarr; ' + escapeHtml(b) + ' PT</span>';
      } catch (e) {}
    }
    html += '</div>';

    html += renderTopTickersRow();

    html += '<div class="summary-row">';
    html += '<span class="pill">' + (day.channels_scanned || 8) + ' channels scanned</span>';
    html += '<span class="pill">' + day.ideas.length + ' member idea' + (day.ideas.length === 1 ? '' : 's') + '</span>';
    const nTech = techCount(day.ideas);
    if (nTech) html += '<span class="pill">' + nTech + ' technical</span>';
    if (typeof day.team_excluded_count === 'number') {
      html += '<span class="pill">' + day.team_excluded_count + ' team post' + (day.team_excluded_count === 1 ? '' : 's') + ' excluded</span>';
    }
    if (typeof day.tactical_excluded_count === 'number') {
      html += '<span class="pill">' + day.tactical_excluded_count + ' tactical post' + (day.tactical_excluded_count === 1 ? '' : 's') + ' excluded</span>';
    }
    html += techToggleHtml(techCount(day.ideas));
    html += '</div>';

    const visibleIdeas = shown(day.ideas);
    if (day.ideas.length === 0) {
      html += '<div class="empty-state">No qualifying member ideas in this window.</div>';
    } else if (visibleIdeas.length === 0) {
      html += '<div class="empty-state">All ideas this week are technical calls, which are hidden.</div>';
    } else {
      html += renderChannelsForIdeas(visibleIdeas, '');
    }

    html += '<div class="filter-footer"><strong>Filters applied:</strong> Macro Ops team (Alexander Barrow, Mike Gyulai, Brandon Beylo, Dean Christians, Tony Dundas-Lucca) is excluded. Tactical management updates (trims, profit-taking, exits without new thesis) are also filtered regardless of author. Ideas based only on charts, momentum or positioning are tagged <strong>Technical</strong> and can be hidden. Sourcing long-term community-member ideas only.</div>';

    main.innerHTML = html;
  }

  function render() {
    renderSidebar(searchQuery);
    const day = days.find(d => d.date === activeDate) || days[0] || null;
    if (day) activeDate = day.date;
    renderMain(day, searchQuery);
  }

  main.addEventListener('click', (e) => {
    if (e.target.closest('#tech-toggle')) {
      hideTechnical = !hideTechnical;
      try { sessionStorage.setItem('mo-tradeideas-hide-technical', hideTechnical ? '1' : '0'); } catch (e2) {}
      render();
      return;
    }
    const pill = e.target.closest('.ticker-pill');
    if (pill) {
      const ticker = pill.dataset.ticker;
      const scope = pill.dataset.scope;
      searchInput.value = ticker;
      searchQuery = ticker;
      searchScope = scope;
      searchClear.classList.add('visible');
      render();
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    const bannerClose = e.target.closest('.banner-close');
    if (bannerClose) {
      searchInput.value = '';
      searchQuery = '';
      searchScope = null;
      searchClear.classList.remove('visible');
      render();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  });

  main.addEventListener('change', (e) => {
    if (e.target && e.target.id === 'lookback-select') {
      lookbackPeriod = e.target.value;
      render();
    }
  });

  searchInput.addEventListener('input', () => {
    searchQuery = searchInput.value.trim();
    searchScope = null; // any manual typing clears scope
    searchClear.classList.toggle('visible', searchQuery.length > 0);
    render();
  });
  searchClear.addEventListener('click', () => {
    searchInput.value = '';
    searchQuery = '';
    searchScope = null;
    searchClear.classList.remove('visible');
    searchInput.focus();
    render();
  });

  const onKeydown = (e) => {
    if (e.key === '/' && document.activeElement !== searchInput) {
      e.preventDefault();
      searchInput.focus();
      searchInput.select();
    } else if (e.key === 'Escape' && document.activeElement === searchInput) {
      searchInput.value = '';
      searchQuery = '';
      searchScope = null;
      searchClear.classList.remove('visible');
      render();
      searchInput.blur();
    }
  };
  document.addEventListener('keydown', onKeydown);

  render();
  return () => document.removeEventListener('keydown', onKeydown);

}
