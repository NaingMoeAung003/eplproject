// --- GLOBAL STATE ---
let teams = {}; 
let matches = [];
let allNews = [];

// --- APP START ---
document.addEventListener('DOMContentLoaded', () => {
    console.log("🚀 App Started...");
    
    // 1. Fetch Basic Data (Teams/Matches for Results page etc.)
    fetchAllData();

    // 2. CHECK PAGE: Live Scores
    const liveContainer = document.getElementById('live-scores-container');
    if (liveContainer) {
        fetchLiveScores(); 
        setInterval(fetchLiveScores, 60000); 
    }

    // 3. CHECK PAGE: Results
    const resultsContainer = document.getElementById('matches-container');
    if (resultsContainer) {
        fetchAPIFixtures();
    }

    // 4. CHECK PAGE: Standings
    const standingsBody = document.getElementById('standings-body');
    if (standingsBody) {
        fetchAPIStandings();
    }
    
    // 5. CHECK PAGE: Admin Dashboard
    // Only run these functions if we are on the dashboard
    if (document.getElementById('admin-news-list')) {
        populateTeamsFromAPI(); // For Add Player Dropdown
        loadAdminNews();        // For Delete News List
        loadAdminTeams();       // For Delete Team List
    }

    // 6. Search Function (Results Page)
    const searchInput = document.getElementById('search-input');
    if (searchInput) {
        searchInput.addEventListener('keyup', function(e) {
            const searchTerm = e.target.value.toLowerCase();
            const cards = document.querySelectorAll('.match-card');
            cards.forEach(card => {
                const text = card.innerText.toLowerCase();
                card.style.display = text.includes(searchTerm) ? 'flex' : 'none';
            });
        });
    }
});

// --- DATA FETCHING (Global) ---
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
        
        // Fetch News for News Page
        try {
            const newsRes = await fetch('/api/external-news');
            allNews = await newsRes.json();
            renderNews();
        } catch(e) {}

    } catch (error) { console.error("Data Error:", error); }
}

// RENDER NEWS (Public Page)
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
                    <img src="${imgUrl}" onerror="this.src='https://upload.wikimedia.org/wikipedia/en/f/f2/Premier_League_Logo.svg'" style="width:100%; height:100%; object-fit:cover;">
                </div>
                <div style="padding:15px;">
                    <h3 style="margin-top:0; font-size:1rem; color:var(--secondary); height: 50px; overflow: hidden; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical;">${n.title}</h3>
                    <small style="color:#888; display:block; margin-bottom:10px;">📅 ${n.date}</small>
                    <a href="${n.link}" target="_blank" style="display:inline-block; margin-top:10px; padding:8px 15px; background:var(--primary-light); color:white; text-decoration:none; border-radius:5px; font-size:0.8rem; border: 1px solid #444;">Read Full Story <i class="fas fa-external-link-alt"></i></a>
                </div>
            </div>`;
    });
}

// ==========================================
// 🔴 ADMIN DASHBOARD FUNCTIONS
// ==========================================

// 1. Populate Dropdown for "Add Player"
async function populateTeamsFromAPI() {
    const dropdown = document.getElementById("input-player-team");
    if(!dropdown) return;
    
    // We use the local database teams first for consistency in admin panel
    try {
        const res = await fetch('/api/data');
        const data = await res.json();
        const teams = data.teams;
        
        dropdown.innerHTML = '<option value="" disabled selected>Select Team</option>';
        if (teams.length > 0) {
            teams.forEach(t => {
                dropdown.innerHTML += `<option value="${t.code}">${t.name}</option>`;
            });
        } else {
             dropdown.innerHTML = '<option value="" disabled>No Teams Found</option>';
        }
    } catch (e) { dropdown.innerHTML = '<option disabled>Error Loading</option>'; }
}

// 2. LOAD & DELETE NEWS
async function loadAdminNews() {
    const list = document.getElementById('admin-news-list');
    if(!list) return;

    try {
        // Fetch local news (created by admin)
        const res = await fetch('/api/news');
        const news = await res.json();
        list.innerHTML = '';
        
        if(news.length === 0) list.innerHTML = '<p style="color:#666; text-align:center;">No local news posted yet.</p>';

        news.forEach(n => {
            list.innerHTML += `
                <div class="admin-list-item">
                    <span style="color:white; font-size:0.9rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 80%;">${n.title}</span>
                    <button onclick="deleteNews('${n._id}')" class="btn-delete" title="Delete News">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>`;
        });
    } catch(e) { console.error(e); }
}

async function deleteNews(id) {
    if(!confirm("Are you sure you want to delete this news?")) return;
    await fetch(`/api/news/${id}`, { method: 'DELETE' });
    loadAdminNews(); // Refresh list
}

// 3. LOAD & DELETE TEAMS
async function loadAdminTeams() {
    const list = document.getElementById('admin-team-list');
    const playerSelect = document.getElementById('view-player-team-select');
    if(!list) return;

    try {
        const res = await fetch('/api/data');
        const data = await res.json();
        const teams = data.teams;
        
        list.innerHTML = '';
        // Also update the dropdown for viewing players
        if(playerSelect) playerSelect.innerHTML = '<option value="" disabled selected>Select Team to View Players</option>';

        if(teams.length === 0) list.innerHTML = '<p style="color:#666; text-align:center;">No teams registered.</p>';

        teams.forEach(t => {
            // Add to Delete List
            list.innerHTML += `
                <div class="admin-list-item">
                    <div style="display:flex; align-items:center; gap:10px;">
                        <img src="${t.logo}" width="25" onerror="this.style.display='none'">
                        <span style="color:white;">${t.name} <small style="color:#666">(${t.code})</small></span>
                    </div>
                    <button onclick="deleteTeam('${t.code}')" class="btn-delete" title="Delete Team">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>`;

            // Add to Dropdown
            if(playerSelect) {
                playerSelect.innerHTML += `<option value="${t.code}">${t.name}</option>`;
            }
        });

    } catch(e) { console.error(e); }
}

async function deleteTeam(code) {
    if(!confirm("⚠️ Warning: Deleting a team will delete ALL its players too. Continue?")) return;
    await fetch(`/api/team/${code}`, { method: 'DELETE' });
    loadAdminTeams(); // Refresh list
    populateTeamsFromAPI(); // Refresh input dropdowns
}

// 4. LOAD & DELETE PLAYERS
async function loadAdminPlayers(teamCode) {
    const list = document.getElementById('admin-player-list');
    list.innerHTML = '<p style="color:#aaa; text-align:center;">Loading players...</p>';
    
    try {
        const res = await fetch(`/api/local-squad/${teamCode}`);
        const players = await res.json();
        
        list.innerHTML = '';
        if(players.length === 0) list.innerHTML = '<p style="color:#666; text-align:center;">No players in this team.</p>';

        players.forEach(p => {
            list.innerHTML += `
                <div class="admin-list-item">
                    <span style="color:white; font-size:0.9rem;">
                        <span style="color:var(--secondary); font-weight:bold; margin-right:5px;">${p.number}</span> 
                        ${p.name} 
                        <small style="color:#888; margin-left:5px;">(${p.pos})</small>
                    </span>
                    <button onclick="deletePlayer('${teamCode}', '${p.name}')" class="btn-delete" title="Delete Player">
                        <i class="fas fa-times"></i>
                    </button>
                </div>`;
        });
    } catch(e) { 
        list.innerHTML = '<p style="color:red; text-align:center;">Error loading players</p>';
    }
}

async function deletePlayer(teamCode, playerName) {
    if(!confirm(`Delete player ${playerName}?`)) return;
    await fetch(`/api/player/${teamCode}/${playerName}`, { method: 'DELETE' });
    loadAdminPlayers(teamCode); // Refresh only the player list
}

// --- ADMIN INSERT ACTIONS (Helpers) ---
async function sendData(url, method, data) { 
    const res = await fetch(url, {method, headers:{'Content-Type':'application/json'}, body:JSON.stringify(data)});
    const json = await res.json();
    if(json.status === 'success') {
        alert("Success!");
        // Reload specific sections instead of full page reload for better UX
        if(url.includes('news')) { 
            loadAdminNews(); 
            document.getElementById('news-title').value = '';
            document.getElementById('news-content').value = '';
        }
        else if(url.includes('team')) { 
            loadAdminTeams(); 
            populateTeamsFromAPI();
            document.getElementById('new-team-name').value = '';
            document.getElementById('new-team-code').value = '';
        }
        else if(url.includes('player')) {
             // Reload player list if that team is currently selected
             const currentViewTeam = document.getElementById('view-player-team-select').value;
             if(currentViewTeam === data.team_code) loadAdminPlayers(data.team_code);
             document.getElementById('new-player-name').value = '';
             document.getElementById('new-player-number').value = '';
        }
    } else {
        alert("Error: " + (json.error || "Unknown error"));
    }
}

function registerNewTeam() { 
    sendData('/api/team', 'POST', { 
        name: document.getElementById('new-team-name').value, 
        code: document.getElementById('new-team-code').value, 
        logo: document.getElementById('new-team-logo').value 
    }); 
}

function registerNewPlayer() { 
    const teamCode = document.getElementById('input-player-team').value;
    if(!teamCode) { alert("Please select a team first"); return; }
    
    sendData('/api/player', 'POST', { 
        team_code: teamCode, 
        name: document.getElementById('new-player-name').value, 
        number: document.getElementById('new-player-number').value, 
        pos: document.getElementById('new-player-pos').value 
    }); 
}

function postNews() { 
    sendData('/api/news', 'POST', { 
        title:document.getElementById('news-title').value, 
        content:document.getElementById('news-content').value, 
        image:document.getElementById('news-image').value 
    }); 
}

// --- PUBLIC PAGE FUNCTIONS ---
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
    matchesList.sort((a,b) => new Date(b.fixture.date) - new Date(a.fixture.date));
    matchesList.forEach(m => {
        const date = new Date(m.fixture.date).toLocaleDateString();
        const score = m.goals.home !== null ? `${m.goals.home} - ${m.goals.away}` : "VS";
        const statusColor = m.fixture.status.short === 'FT' ? '#00ff85' : '#aaa';
        container.innerHTML += `
            <div class="match-card" id="match-${m.fixture.id}">
                <div class="match-header"><span>${date}</span><span style="color:${statusColor}">${m.fixture.status.short}</span></div>
                <div class="match-content">
                    <div class="team"><img src="${m.teams.home.logo}" width="25"> <span>${m.teams.home.name}</span></div>
                    <div class="score-badge">${score}</div>
                    <div class="team away"><span>${m.teams.away.name}</span> <img src="${m.teams.away.logo}" width="25"></div>
                </div>
            </div>`;
    });
}

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
                            <div class="score-badge" style="background:${isLive ? '#ff005a' : '#333'}">${goals.home??0} - ${goals.away??0}</div>
                            <div class="team away">${away.name} <img src="${away.logo}" width="25"></div>
                        </div>
                    </div>`;
            });
        } else { container.innerHTML = '<div style="text-align:center; padding:20px;"><p>No live matches currently.</p></div>'; }
    } catch (e) { console.error(e); }
}

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
                <td><div class="team-cell"><img src="${item.team.logo}" width="25"> <span>${item.team.name}</span></div></td>
                <td>${item.all.played}</td><td>${item.all.win}</td><td>${item.all.draw}</td><td>${item.all.lose}</td>
                <td style="color:${item.goalsDiff>0?'#00ff85':'#ff005a'}">${item.goalsDiff>0?'+'+item.goalsDiff:item.goalsDiff}</td>
                <td class="points-cell">${item.points}</td><td>${formHTML}</td>
            </tr>`;
    });
}