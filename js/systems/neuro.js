class NeuroSystem {
    static tick(npc) {
        npc.neuro.ADR = Math.max(0, npc.neuro.ADR - 0.5);
        npc.neuro.CRT = Math.max(0, npc.neuro.CRT - 0.2);
        npc.neuro.OXY = Math.max(0, npc.neuro.OXY - 0.1);
        npc.activeTraits = [];
        for (const key in TRAITS) {
            if (TRAITS[key].cond(npc)) npc.activeTraits.push(key);
        }
    }
}
