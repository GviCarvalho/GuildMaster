let resources = [];
let stockpiles = [];
let npcs = [];
let worldStats = { crimes: 0, deaths: 0 };
let speed = 1;
let hoveredNPC = null;
let animationID;

const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');

function initWorld() {
    if (canvas.width === 0) {
        canvas.width = document.getElementById('game-view').offsetWidth;
        canvas.height = document.getElementById('game-view').offsetHeight;
    }

    resources = [];
    stockpiles = [];
    npcs = [];
    worldStats = { crimes: 0, deaths: 0 };

    for (let i = 0; i < 30; i++) {
        const type = Math.random() > 0.6 ? 'ROCK' : Math.random() > 0.5 ? 'TREE' : 'FIELD';
        resources.push(new Resource(type, Math.random() * canvas.width, Math.random() * canvas.height));
    }

    for (let i = 0; i < 15; i++) npcs.push(new NPC(i));
}

function createPopup(x, y, text, color) {
    const d = document.createElement('div');
    d.className = 'float-text';
    d.innerText = text;
    d.style.color = color;
    d.style.left = `${x}px`;
    d.style.top = `${y}px`;
    document.getElementById('overlay').appendChild(d);
    setTimeout(() => d.remove(), 1500);
}

function draw() {
    ctx.fillStyle = '#151b24';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    resources.forEach(r => {
        if (r.amt <= 0) return;
        const sz = 3 + r.amt / 15;
        ctx.fillStyle = r.type === 'FIELD' ? '#f1c40f' : r.type === 'TREE' ? '#27ae60' : '#95a5a6';
        ctx.beginPath();
        ctx.arc(r.x, r.y, sz, 0, Math.PI * 2);
        ctx.fill();
        if (r.ownerID !== null) {
            ctx.strokeStyle = 'rgba(231,76,60,0.4)';
            ctx.beginPath();
            ctx.arc(r.x, r.y, 15, 0, Math.PI * 2);
            ctx.stroke();
        }
    });

    stockpiles.forEach(s => {
        const owner = npcs.find(n => n.id === s.ownerID);
        if (!owner || !owner.alive) return;
        ctx.fillStyle = s.color;
        ctx.fillRect(s.x - 8, s.y - 8, 16, 16);
        ctx.strokeStyle = 'rgba(255,255,255,0.1)';
        ctx.beginPath();
        ctx.arc(s.x, s.y, 50, 0, Math.PI * 2);
        ctx.stroke();
    });

    npcs.forEach(n => {
        if (!n.alive) {
            ctx.fillStyle = '#444';
            ctx.fillText('💀', n.x - 5, n.y + 5);
            return;
        }
        if (n.activeTraits.includes('BERSERKER')) ctx.fillStyle = '#c0392b';
        else if (n.activeTraits.includes('COVARDE')) ctx.fillStyle = '#34495e';
        else ctx.fillStyle = JOBS[n.job].color;

        const mass = 4 + (n.bio.FAT + n.bio.PROT) / 200;
        ctx.beginPath();
        ctx.arc(n.x, n.y, mass, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = 'black';
        ctx.fillRect(n.x - 8, n.y - 12, 16, 3);
        ctx.fillStyle = '#2ecc71';
        ctx.fillRect(n.x - 8, n.y - 12, 16 * (n.bio.ATP / SUBSTANCES.ATP.max), 3);
    });
}

function updateUI() {
    document.getElementById('st-pop').innerText = npcs.filter(n => n.alive).length;
    document.getElementById('st-dead').innerText = worldStats.deaths;
    document.getElementById('st-crime').innerText = worldStats.crimes;

    if (hoveredNPC && hoveredNPC.alive) {
        const n = hoveredNPC;
        document.getElementById('scanner-card').style.display = 'block';
        document.getElementById('p-name').innerText = `Cidadão #${n.id}`;
        document.getElementById('p-job').innerText = JOBS[n.job].label;
        document.getElementById('p-action').innerText = n.action;

        const drawBar = (id, val, max, col) => {
            const w = Math.min(100, (val / max) * 100);
            return `<div class="stat-row"><span>${id}</span><span>${val.toFixed(0)}</span></div>
                    <div class="bar-container"><div class="bar-fill" style="width:${w}%; background:${col}"></div></div>`;
        };

        let bioH = '';
        for (const key in n.bio) bioH += drawBar(SUBSTANCES[key].name, n.bio[key], SUBSTANCES[key].max, SUBSTANCES[key].color);
        document.getElementById('p-bio').innerHTML = bioH;

        let neuroH = '';
        for (const key in n.neuro) neuroH += drawBar(SUBSTANCES[key].name, n.neuro[key], 100, SUBSTANCES[key].color);
        document.getElementById('p-neuro').innerHTML = neuroH;

        let traitsH = '';
        n.activeTraits.forEach(t => (traitsH += `<span class="tag" style="background:${TRAITS[t].color}">${t}</span>`));
        document.getElementById('p-traits').innerHTML = traitsH || '<span style="color:#555; font-size:10px">Neutro</span>';

        let ecoH = `<div class="stat-row"><span style="color:#f1c40f">Ouro</span><span>$${n.inv.GOLD}</span></div>`;
        for (const key in n.inv) if (key !== 'GOLD' && n.inv[key] > 0) ecoH += `<div class="stat-row"><span>${key}</span><span>${n.inv[key]}</span></div>`;
        document.getElementById('p-eco').innerHTML = ecoH;
    } else {
        document.getElementById('scanner-card').style.display = 'none';
    }
}

function resetSim() {
    cancelAnimationFrame(animationID);
    initWorld();
    loop();
}

function loop() {
    try {
        for (let i = 0; i < speed; i++) {
            npcs.forEach(n => n.update());
            if (Math.random() < 0.02) {
                const r = resources[Math.floor(Math.random() * resources.length)];
                if (r && r.amt < 50) r.amt++;
            }
        }
        draw();
        updateUI();
        animationID = requestAnimationFrame(loop);
    } catch (err) {
        console.error('Simulação parada devido a erro:', err);
        document.getElementById('error-msg').style.display = 'block';
    }
}

function toggleSpeed() {
    speed = speed === 1 ? 20 : 1;
}

window.resetSim = resetSim;
window.toggleSpeed = toggleSpeed;

canvas.addEventListener('mousemove', e => {
    const r = canvas.getBoundingClientRect();
    hoveredNPC = npcs.find(n => Math.hypot(n.x - (e.clientX - r.left), n.y - (e.clientY - r.top)) < 20);
});

initWorld();
loop();
