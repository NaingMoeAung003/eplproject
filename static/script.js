// --- GLOBAL STATE ---
let teams = {}; 
let matches = [];
let allNews = [];

// --- APP START ---
document.addEventListener('DOMContentLoaded', () => {
    console.log("🚀 App Started...");
    
    // 1. Fetch Basic Data
    fetchAllData();

    // 2. Page Specific: Live Scores
    const liveContainer = document.getElementById('live-scores-container');
    if (liveContainer) {
        fetchLiveScores(); 
        setInterval(fetchLiveScores, 60000); // Auto refresh every 1 min
    }

    // 3. Page Specific: Results (Fixtures)
    const resultsContainer = document.getElementById('matches-container');
    if (resultsContainer) {
        fetchAPIFixtures();
    }

    // 4. Page Specific: Standings
    const standingsBody = document.getElementById('standings-body');
    if (standingsBody) {
        fetchAPIStandings();
    }
    
    // 5. Admin Dropdown Trigger
    if (document.getElementById('input-player-team')) {
        populateTeamsFromAPI();
    }

    // 🟢 6. SEARCH FUNCTION (New Feature)
    const searchInput = document.getElementById('search-input');
    if (searchInput) {
        searchInput.addEventListener('keyup', function(e) {
            const searchTerm = e.target.value.toLowerCase();
            const cards = document.querySelectorAll('.match-card');

            cards.forEach(card => {
                const text = card.innerText.toLowerCase();
                if (text.includes(searchTerm)) {
                    card.style.display = 'flex';
                } else {
                    card.style.display = 'none';
                }
            });
        });
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
        
        // Fetch News
        try {
            const newsRes = await fetch('/api/external-news');
            allNews = await newsRes.json();
            renderNews();
        } catch(e) {}

    } catch (error) { console.error("Data Error:", error); }
}

// RENDER NEWS
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
                         onerror="this.src='https://upload.wikimedia.org/wikipedia/en/f/f2/Premier_League_Logo.svg'" 
                         style="width:100%; height:100%; object-fit:cover;">
                </div>
                <div style="padding:15px;">
                    <h3 style="margin-top:0; font-size:1rem; color:var(--secondary); height: 50px; overflow: hidden; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical;">${n.title}</h3>
                    <small style="color:#888; display:block; margin-bottom:10px;">📅 ${n.date}</small>
                    <a href="${n.link}" target="_blank" style="display:inline-block; margin-top:10px; padding:8px 15px; background:var(--primary-light); color:white; text-decoration:none; border-radius:5px; font-size:0.8rem; border: 1px solid #444;">
                        Read Full Story <i class="fas fa-external-link-alt"></i>
                    </a>
                </div>
            </div>`;
    });
}

// --- ADMIN TEAM DROPDOWN ---
async function populateTeamsFromAPI() {
    const dropdown = document.getElementById("input-player-team");
    if(!dropdown) return;
    dropdown.innerHTML = '<option value="" disabled selected>Loading Teams...</option>';
    try {
        const res = await fetch('/api/standings');
        const data = await res.json();
        if (data.response && data.response.length > 0) {
            const standings = data.response[0].league.standings[0];
            standings.sort((a, b) => a.team.name.localeCompare(b.team.name));
            dropdown.innerHTML = '<option value="" disabled selected>Select Team</option>';
            standings.forEach(item => {
                dropdown.innerHTML += `<option value="${item.team.id}">${item.team.name}</option>`;
            });
        }
    } catch (e) { dropdown.innerHTML = '<option disabled>Error Loading</option>'; }
}

// --- API FIXTURES (RESULTS PAGE) ---
async function fetchAPIFixtures() {
    const container = document.getElementById('matches-container');
    if(!container) return;
    
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
    
    // Sort by Date (Newest first)
    matchesList.sort((a,b) => new Date(b.fixture.date) - new Date(a.fixture.date));
    
    matchesList.forEach(m => {
        const date = new Date(m.fixture.date).toLocaleDateString();
        const score = m.goals.home !== null ? `${m.goals.home} - ${m.goals.away}` : "VS";
        const statusColor = m.fixture.status.short === 'FT' ? '#00ff85' : '#aaa';
        
        container.innerHTML += `
            <div class="match-card" id="match-${m.fixture.id}">
                <div class="match-header">
                    <span>${date}</span>
                    <span style="color:${statusColor}">${m.fixture.status.short}</span>
                </div>
                <div class="match-content">
                    <div class="team">
                        <img src="${m.teams.home.logo}" width="25"> 
                        <span>${m.teams.home.name}</span>
                    </div>
                    <div class="score-badge">${score}</div>
                    <div class="team away">
                        <span>${m.teams.away.name}</span> 
                        <img src="${m.teams.away.logo}" width="25">
                    </div>
                </div>
                <div style="text-align:center; margin-top:10px; border-top:1px solid #333; padding-top:10px;">
                    <button onclick="loadScorers(${m.fixture.id})" style="background:#333; color:#ccc; border:none; border-radius:4px; font-size:0.8rem; padding:5px 10px; cursor:pointer;">
                        ⚽ Scorers
                    </button>
                    <div id="scorers-${m.fixture.id}" style="margin-top:10px; font-size:0.9rem; color:#ccc; display:none;"></div>
                </div>
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
            if (goals.length > 0) {
                goals.forEach(g => {
                    container.innerHTML += `
                        <div style="display:flex; justify-content:space-between; border-bottom:1px solid #444; padding:3px 0;">
                            <span>${g.detail==="Normal Goal"?"⚽":"🔴 OG"} ${g.player.name} (${g.time.elapsed}')</span>
                            <span style="color:#888;">${g.team.name}</span>
                        </div>`;
                });
            } else {
                container.innerHTML = '<span style="color:#888;">No goals scored.</span>';
            }
        }
    } catch(e) { container.innerHTML = 'Error loading data.'; }
}

// --- LIVE SCORES ---
async function fetchLiveScores() {
    const container = document.getElementById('live-scores-container');
    if (!container) return;
    
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
                const isLive = ['1H','2H','HT','ET'].includes(status);
                
                container.innerHTML += `
                    <div class="match-card">
                        <div class="match-header">
                            <span>${new Date(match.fixture.date).toLocaleDateString()}</span>
                            <span style="color:${isLive ? '#ff005a' : '#aaa'}; font-weight:bold;">
                                ${isLive ? '🔴 LIVE ' + match.fixture.status.elapsed + "'" : status}
                            </span>
                        </div>
                        <div class="match-content">
                            <div class="team"><img src="${home.logo}" width="25"> ${home.name}</div>
                            <div class="score-badge" style="background:${isLive ? '#ff005a' : '#333'}">
                                ${goals.home??0} - ${goals.away??0}
                            </div>
                            <div class="team away">${away.name} <img src="${away.logo}" width="25"></div>
                        </div>
                        <div style="text-align:center; margin-top:10px;">
                            <button onclick="toggleMatchStats(${matchId})" class="btn-stats">📊 Stats</button>
                        </div>
                        <div id="details-${matchId}" class="match-details" style="display:none;">Loading...</div>
                    </div>`;
            });
        } else {
            container.innerHTML = '<div style="text-align:center; padding:20px;"><p>No live matches currently.</p></div>'; 
        }
    } catch (e) { console.error(e); }
}

async function toggleMatchStats(matchId) {
    const detailsDiv = document.getElementById(`details-${matchId}`);
    if (detailsDiv.style.display === 'block') { detailsDiv.style.display = 'none'; return; }
    detailsDiv.style.display = 'block';

    try {
        const [resEvents, resStats] = await Promise.all([
            fetch(`/api/events/${matchId}`), 
            fetch(`/api/stats/${matchId}`)
        ]);
        const events = await resEvents.json();
        const stats = await resStats.json();

        let html = '<div style="padding:10px;">';
        
        // Stats
        if (stats.response && stats.response.length === 2) {
            const h = stats.response[0].statistics;
            const a = stats.response[1].statistics;
            const getVal = (arr, type) => { const x = arr.find(s=>s.type===type); return x?x.value:0; };
            
            html += `
                <div style="display:flex; justify-content:space-between; margin-bottom:5px; color:#aaa; font-size:0.8rem;">
                    <span>Home</span><span>Possession</span><span>Away</span>
                </div>
                <div class="progress-bar" style="margin-bottom:15px;">
                    <div style="width:${getVal(h,'Ball Possession')}; background:var(--secondary);"></div>
                    <div style="width:${getVal(a,'Ball Possession')}; background:var(--accent);"></div>
                </div>`;
        }
        
        html += '</div>';
        detailsDiv.innerHTML = html;
    } catch (e) { detailsDiv.innerHTML = 'Error loading stats.'; }
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

function renderAPIStandings(list) {
    const tbody = document.getElementById('standings-body');
    tbody.innerHTML = '';
    list.forEach(item => {
        let formHTML = "";
        (item.form || "").split('').forEach(char => {
            let color = char==='W'?'#00ff85':char==='L'?'#ff005a':'#888';
            formHTML += `<span style="color:${color}; font-weight:bold; margin-right:2px;">${char}</span>`;
        });
        
        tbody.innerHTML += `
            <tr onclick="window.location.href='/team/${item.team.id}'" style="cursor:pointer;">
                <td style="color:#666;">${item.rank}</td>
                <td>
                    <div class="team-cell">
                        <img src="${item.team.logo}" width="25"> 
                        <span>${item.team.name}</span>
                    </div>
                </td>
                <td>${item.all.played}</td>
                <td>${item.all.win}</td>
                <td>${item.all.draw}</td>
                <td>${item.all.lose}</td>
                <td style="color:${item.goalsDiff>0?'#00ff85':'#ff005a'}">${item.goalsDiff>0?'+'+item.goalsDiff:item.goalsDiff}</td>
                <td class="points-cell">${item.points}</td>
                <td>${formHTML}</td>
            </tr>`;
    });
}

// --- ADMIN ACTIONS (Helper) ---
async function sendData(url, method, data) { 
    await fetch(url, {method, headers:{'Content-Type':'application/json'}, body:JSON.stringify(data)}); 
    alert("Success"); 
    location.reload(); 
}
function registerNewTeam() { sendData('/api/team', 'POST', { name: document.getElementById('new-team-name').value, code: document.getElementById('new-team-code').value, logo: document.getElementById('new-team-logo').value }); }
function registerNewPlayer() { sendData('/api/player', 'POST', { team_code: document.getElementById('input-player-team').value, name: document.getElementById('new-player-name').value, number: document.getElementById('new-player-number').value, pos: document.getElementById('new-player-pos').value }); }
function postNews() { sendData('/api/news', 'POST', { title:document.getElementById('news-title').value, content:document.getElementById('news-content').value, image:document.getElementById('news-image').value }); }