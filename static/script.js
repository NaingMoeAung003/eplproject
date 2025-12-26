// --- GLOBAL STATE ---
let teams = {}; 
let matches = [];
let allNews = [];

// --- APP START ---
document.addEventListener('DOMContentLoaded', () => {
    console.log("🚀 App Started...");
    
    // 1. Fetch Data
    fetchAllData();

    // 2. Page Specific Checks
    const liveContainer = document.getElementById('live-scores-container');
    const resultsContainer = document.getElementById('matches-container');
    const standingsBody = document.getElementById('standings-body');

    if (liveContainer) {
        fetchLiveScores(); 
        setInterval(fetchLiveScores, 60000);
    }

    if (resultsContainer && document.title.includes("Fixtures")) {
        if (typeof fetchAPIFixtures === 'function') fetchAPIFixtures();
    }

    if (standingsBody) {
        fetchAPIStandings();
    }
    
    // Admin Dropdown Trigger
    if (document.getElementById('input-player-team')) {
        populateTeamsFromAPI();
    }
});

// --- DATA FETCHING ---
async function fetchAllData() {
    try {
        const res = await fetch('/api/data');
        const data = await res.json();
        
        teams = {};
        if (data.teams && Array.isArray(data.teams)) {
            data.teams.forEach(t => {
                const key = t.code || t._id;
                teams[key] = t;
            });
        }
        matches = data.matches || [];
        
        try {
            const newsRes = await fetch('/api/external-news');
            allNews = await newsRes.json();
        } catch(e) {}

        renderNews();

    } catch (error) { console.error("Data Error:", error); }
}

// 🟢 RENDER NEWS (Image Fix)
function renderNews() {
    const el = document.getElementById('news-container');
    if(!el) return;
    
    if (allNews.length === 0) {
        el.innerHTML = '<p style="text-align:center; color:#aaa;">Loading News...</p>';
        return;
    }
    
    el.innerHTML = '';
    allNews.forEach(n => {
        const imgUrl = n.image || 'https://upload.wikimedia.org/wikipedia/en/f/f2/Premier_League_Logo.svg';
        
        el.innerHTML += `
            <div class="card news-card">
                <div style="height:180px; overflow:hidden; background: #37003c; display:flex; align-items:center; justify-content:center;">
                    <img src="${imgUrl}" 
                         onerror="this.onerror=null; this.src='https://upload.wikimedia.org/wikipedia/en/f/f2/Premier_League_Logo.svg'; this.style.padding='20px'; this.style.objectFit='contain';" 
                         style="width:100%; height:100%; object-fit:cover; transition: transform 0.3s;">
                </div>
                <div style="padding:15px;">
                    <h3 style="margin-top:0; font-size:1rem; color:var(--secondary); height: 50px; overflow: hidden; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical;">${n.title}</h3>
                    <small style="color:#888; display:block; margin-bottom:10px;">📅 ${n.date}</small>
                    <p style="font-size:0.85rem; color:#ccc; height: 60px; overflow: hidden; display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical;">${n.content}</p>
                    <a href="${n.link}" target="_blank" style="display:inline-block; margin-top:10px; padding:8px 15px; background:var(--primary-light); color:white; text-decoration:none; border-radius:5px; font-size:0.8rem; border: 1px solid #444;">
                        Read Full Story <i class="fas fa-external-link-alt"></i>
                    </a>
                </div>
            </div>`;
    });
}

// --- ADMIN DROPDOWN ---
async function populateTeamsFromAPI() {
    const dropdown = document.getElementById("input-player-team");
    if(!dropdown) return;
    dropdown.innerHTML = '<option value="" disabled selected>Loading Teams from API...</option>';
    try {
        const res = await fetch('/api/standings');
        const data = await res.json();
        if (data.response && data.response.length > 0) {
            const standings = data.response[0].league.standings[0];
            standings.sort((a, b) => a.team.name.localeCompare(b.team.name));
            dropdown.innerHTML = '<option value="" disabled selected>Select Team (API Source)</option>';
            standings.forEach(item => {
                dropdown.innerHTML += `<option value="${item.team.id}">${item.team.name}</option>`;
            });
        } else { dropdown.innerHTML = '<option disabled>No Teams Found</option>'; }
    } catch (e) { dropdown.innerHTML = '<option disabled>Error Loading Teams</option>'; }
}

// --- API FIXTURES ---
async function fetchAPIFixtures() {
    const container = document.getElementById('matches-container');
    if(!container) return;
    container.innerHTML = '<p style="text-align:center; color:#aaa; padding:20px;">Loading Season 2023 Results...</p>';
    try {
        const res = await fetch('/api/fixtures');
        const data = await res.json();
        if (data.response) renderAPIMatches(data.response);
        else container.innerHTML = '<p>No fixtures found.</p>';
    } catch(e) { container.innerHTML = '<p style="text-align:center; color:red;">API Error</p>'; }
}

function renderAPIMatches(matchesList) {
    const container = document.getElementById('matches-container');
    container.innerHTML = '';
    matchesList.sort((a,b) => new Date(b.fixture.date) - new Date(a.fixture.date));
    matchesList.forEach(m => {
        const date = new Date(m.fixture.date).toLocaleDateString();
        const score = m.goals.home !== null ? `${m.goals.home} - ${m.goals.away}` : "VS";
        container.innerHTML += `
            <div class="match-card" id="match-${m.fixture.id}">
                <div class="match-header"><span>${date}</span><span style="color:${m.fixture.status.short==='FT'?'#00ff85':'#aaa'}">${m.fixture.status.short}</span></div>
                <div class="match-content"><div class="team"><img src="${m.teams.home.logo}" width="25"> <span>${m.teams.home.name}</span></div><div class="score-badge">${score}</div><div class="team away"><span>${m.teams.away.name}</span> <img src="${m.teams.away.logo}" width="25"></div></div>
                <div style="text-align:center; margin-top:10px; border-top:1px solid #333; padding-top:10px;"><button onclick="loadScorers(${m.fixture.id})" style="background:#333; color:#ccc; font-size:0.8rem; padding:5px 10px;">⚽ Show Scorers</button><div id="scorers-${m.fixture.id}" style="margin-top:10px; font-size:0.9rem; color:#ccc; display:none;"></div></div>
            </div>`;
    });
}

async function loadScorers(fixtureId) {
    const container = document.getElementById(`scorers-${fixtureId}`);
    if (container.style.display === 'block') { container.style.display = 'none'; return; }
    container.style.display = 'block';
    container.innerHTML = '<span style="color:#aaa;">Loading...</span>';
    try {
        const res = await fetch(`/api/events/${fixtureId}`);
        const data = await res.json();
        if (data.response) {
            container.innerHTML = '';
            const goals = data.response.filter(e => e.type === 'Goal');
            goals.length > 0 ? goals.forEach(g => container.innerHTML += `<div style="display:flex; justify-content:space-between; border-bottom:1px solid #444; padding:3px 0;"><span>${g.detail==="Normal Goal"?"⚽":"🔴 OG"} ${g.player.name} (${g.time.elapsed}')</span><span style="color:#888;">${g.team.name}</span></div>`) : container.innerHTML = '<span style="color:#888;">No goals.</span>';
        }
    } catch(e) { container.innerHTML = 'Error.'; }
}

// 🟢 LIVE SCORES (With Stats Button)
async function fetchLiveScores() {
    const container = document.getElementById('live-scores-container');
    if (!container) return;
    if(container.innerHTML.trim() === '' || container.innerText.includes('Fetch')) 
        container.innerHTML = '<p style="text-align:center; color:#aaa; padding:20px;">Fetching Live Data...</p>';

    try {
        const response = await fetch('/api/live-epl');
        const data = await response.json();
        
        if (data.response && data.response.length > 0) {
            container.innerHTML = '';
            data.response.forEach(match => {
                const home = match.teams.home;
                const away = match.teams.away;
                const goals = match.goals;
                const status = match.fixture.status.short;
                const matchId = match.fixture.id;
                const isLive = ['1H','2H','HT'].includes(status);
                const statusText = isLive ? `🔴 LIVE ${match.fixture.status.elapsed}'` : status;
                
                container.innerHTML += `
                    <div class="match-card" id="card-${matchId}">
                        <div class="match-header"><span>${new Date(match.fixture.date).toLocaleDateString()}</span><span style="color:${isLive ? '#ff005a' : '#aaa'}; font-weight:bold;">${statusText}</span></div>
                        <div class="match-content"><div class="team"><img src="${home.logo}" width="25"> ${home.name}</div><div class="score-badge" style="background:${isLive ? '#ff005a' : '#333'}">${goals.home??0} - ${goals.away??0}</div><div class="team away">${away.name} <img src="${away.logo}" width="25"></div></div>
                        <div style="text-align:center; margin-top:10px; border-top:1px solid #333; padding-top:10px;">
                            <button onclick="toggleMatchStats(${matchId})" class="btn-stats">📊 View Stats & Events</button>
                        </div>
                        <div id="details-${matchId}" class="match-details" style="display:none;"><div style="text-align:center; padding:10px; color:#aaa;"><i class="fas fa-circle-notch fa-spin"></i> Loading Data...</div></div>
                    </div>`;
            });
        } else { container.innerHTML = '<div style="text-align:center; padding:20px;"><p>No matches found.</p></div>'; }
    } catch (e) { console.error(e); }
}

// 🟢 LOAD STATS & EVENTS
async function toggleMatchStats(matchId) {
    const detailsDiv = document.getElementById(`details-${matchId}`);
    if (detailsDiv.style.display === 'block') { detailsDiv.style.display = 'none'; return; }
    detailsDiv.style.display = 'block';

    try {
        const [resEvents, resStats] = await Promise.all([fetch(`/api/events/${matchId}`), fetch(`/api/stats/${matchId}`)]);
        const eventsData = await resEvents.json();
        const statsData = await resStats.json();

        let html = '<div class="stats-grid">';
        if (statsData.response && statsData.response.length === 2) {
            const hStats = statsData.response[0].statistics;
            const aStats = statsData.response[1].statistics;
            const getStat = (arr, type) => { const item = arr.find(s => s.type === type); return item ? item.value : 0; };
            
            const hP = parseInt((getStat(hStats, "Ball Possession")||"50%").toString().replace('%',''));
            const aP = parseInt((getStat(aStats, "Ball Possession")||"50%").toString().replace('%',''));

            html += `
                <div class="stat-box">
                    <h4 style="color:#aaa; font-size:0.8rem; margin:5px 0;">Ball Possession</h4>
                    <div class="progress-bar"><div style="width:${hP}%; background:var(--secondary);"></div><div style="width:${aP}%; background:var(--accent);"></div></div>
                    <div style="display:flex; justify-content:space-between; font-size:0.8rem;"><span>${hP}%</span> <span>${aP}%</span></div>
                    <div class="stat-row"><span>🎯 Shots on Target</span><div><span style="color:var(--secondary)">${getStat(hStats,"Shots on Goal")||0}</span> - <span style="color:var(--accent)">${getStat(aStats,"Shots on Goal")||0}</span></div></div>
                    <div class="stat-row"><span>🟨 Yellow Cards</span><div><span>${getStat(hStats,"Yellow Cards")||0}</span> - <span>${getStat(aStats,"Yellow Cards")||0}</span></div></div>
                    <div class="stat-row"><span>🟥 Red Cards</span><div><span>${getStat(hStats,"Red Cards")||0}</span> - <span>${getStat(aStats,"Red Cards")||0}</span></div></div>
                </div>`;
        } else { html += '<p style="text-align:center; color:#aaa;">No statistics available.</p>'; }

        html += '</div><div class="events-list"><h4 style="color:#fff; border-bottom:1px solid #444; padding-bottom:5px;">⏱️ Key Events</h4>';
        if (eventsData.response && eventsData.response.length > 0) {
            eventsData.response.forEach(e => {
                let icon = e.type==='Goal'?'⚽':e.type==='Card'&&e.detail==='Yellow Card'?'🟨':e.type==='Card'&&e.detail==='Red Card'?'🟥':e.type==='subst'?'🔄':'⚡';
                html += `<div class="event-row"><span style="color:var(--secondary); font-weight:bold; width:30px;">${e.time.elapsed}'</span><span style="font-size:1.2rem; width:30px; text-align:center;">${icon}</span><div style="flex:1;"><span style="color:#fff;">${e.player.name}</span><small style="display:block; color:#888;">${e.team.name}</small></div></div>`;
            });
        } else { html += '<p style="text-align:center; color:#888;">No events yet.</p>'; }
        html += '</div>';
        detailsDiv.innerHTML = html;
    } catch (error) { detailsDiv.innerHTML = '<p style="color:red; text-align:center;">Failed to load data.</p>'; }
}

// --- STANDINGS ---
async function fetchAPIStandings() {
    const tbody = document.getElementById('standings-body');
    if (!tbody) return;
    try {
        const res = await fetch('/api/standings');
        const data = await res.json();
        if (data.response) renderAPIStandings(data.response[0].league.standings[0]);
    } catch (e) { console.error(e); }
}

function renderAPIStandings(standingsList) {
    const tbody = document.getElementById('standings-body');
    tbody.innerHTML = '';
    standingsList.forEach(item => {
        let formHTML = "";
        for (let char of (item.form || "")) {
            let badgeClass = char === 'W' ? 'form-w' : char === 'D' ? 'form-d' : 'form-l';
            formHTML += `<span class="form-badge ${badgeClass}">${char}</span>`;
        }
        tbody.innerHTML += `<tr onclick="window.location.href='/team/${item.team.id}'" style="cursor:pointer;"><td class="rank-cell">${item.rank}</td><td><div class="team-cell"><img src="${item.team.logo}" width="35"> <span>${item.team.name}</span></div></td><td>${item.all.played}</td><td>${item.all.win}</td><td>${item.all.draw}</td><td>${item.all.lose}</td><td style="color:${item.goalsDiff>0?'#00ff85':'#ff005a'}">${item.goalsDiff>0?'+'+item.goalsDiff:item.goalsDiff}</td><td class="points-cell">${item.points}</td><td><div style="display:flex; justify-content:center;">${formHTML}</div></td></tr>`;
    });
}

// Admin Actions
async function sendData(url, method, data) { await fetch(url, {method, headers:{'Content-Type':'application/json'}, body:JSON.stringify(data)}); alert("Success"); location.reload(); }
function registerNewTeam() { sendData('/api/team', 'POST', { name: document.getElementById('new-team-name').value, code: document.getElementById('new-team-code').value, logo: document.getElementById('new-team-logo').value }); }
function registerNewPlayer() { sendData('/api/player', 'POST', { team_code: document.getElementById('input-player-team').value, name: document.getElementById('new-player-name').value, number: document.getElementById('new-player-number').value, pos: document.getElementById('new-player-pos').value }); }
function postNews() { sendData('/api/news', 'POST', { title:document.getElementById('news-title').value, content:document.getElementById('news-content').value, image:document.getElementById('news-image').value }); }