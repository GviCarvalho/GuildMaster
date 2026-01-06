// Tabelas de configuração e rótulos globais
const JOBS = {
    FARMER: { label: 'Fazendeiro', icon: '🌾', color: '#27ae60', raw: 'TRIGO', prod: 'PAO', target: 'FIELD' },
    MINER: { label: 'Mineiro', icon: '⛏️', color: '#95a5a6', raw: 'MINERIO', prod: 'FERRO', target: 'ROCK' },
    LUMBER: { label: 'Lenhador', icon: '🪓', color: '#e67e22', raw: 'MADEIRA', prod: 'TABUA', target: 'TREE' }
};

const SUBSTANCES = {
    H2O: { name: 'Água', color: '#3498db', max: 2000 },
    PROT: { name: 'Proteína', color: '#e74c3c', max: 600 },
    FAT: { name: 'Gordura', color: '#f39c12', max: 500 },
    GLUC: { name: 'Glicose', color: '#f1c40f', max: 100 },
    ATP: { name: 'Energia', color: '#2ecc71', max: 100 },
    ADR: { name: 'Adrenalina', color: '#c0392b' },
    CRT: { name: 'Cortisol', color: '#7f8c8d' },
    OXY: { name: 'Oxitocina', color: '#e056fd' }
};

const TRAITS = {
    BERSERKER: { cond: n => n.neuro.ADR > 60, color: '#c0392b' },
    COVARDE: { cond: n => n.neuro.CRT > 60, color: '#7f8c8d' },
    PACIFISTA: { cond: n => n.neuro.OXY > 50, color: '#e056fd' }
};

const ACTIONS = ['GATHER', 'REFINE', 'TRADE', 'SLEEP', 'EAT', 'FIGHT', 'FLEE', 'IDLE'];
