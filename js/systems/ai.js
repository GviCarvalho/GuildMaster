class AISystem {
    static availableActions(npc) {
        const job = JOBS[npc.job];
        const actions = ['GATHER', 'SLEEP', 'EAT'];
        if (npc.inv[job.raw] > 0) actions.push('REFINE');
        if (npc.inv[job.prod] > 0) actions.push('TRADE');
        if (npc.underAttack) actions.push('FIGHT', 'FLEE');
        return actions;
    }

    static defaultPolicy(npc) {
        const job = JOBS[npc.job];
        if (npc.bio.ATP < 20) return 'SLEEP';
        if (npc.bio.GLUC < 20) return 'EAT';
        if (npc.underAttack) return npc.activeTraits.includes('BERSERKER') ? 'FIGHT' : 'FLEE';
        if (npc.inv[job.raw] > 2) return 'REFINE';
        if (npc.inv[job.prod] > 2) return 'TRADE';
        return 'GATHER';
    }

    static decide(npc) {
        const state = npc.brain.getState(npc);
        const fallback = AISystem.defaultPolicy(npc);
        const actions = AISystem.availableActions(npc);
        if (!actions.includes(fallback)) actions.push(fallback);
        const action = npc.brain.chooseAction(state, actions, fallback);
        npc.brainLastState = state;
        return action;
    }

    static evaluateReward(npc) {
        let reward = 0.05;
        reward += npc.inv.GOLD * 0.001;
        reward += npc.bio.ATP > 50 ? 0.05 : -0.05;
        reward += npc.bio.GLUC > 30 ? 0.05 : -0.05;
        reward -= npc.underAttack ? 0.1 : 0;
        return reward;
    }
}
