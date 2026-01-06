class QLearningBrain {
    constructor(actions, { alpha = 0.2, gamma = 0.8, epsilon = 0.1 } = {}) {
        this.actions = actions;
        this.alpha = alpha;
        this.gamma = gamma;
        this.epsilon = epsilon;
        this.q = new Map();
    }

    getState(npc) {
        const energy = npc.bio.ATP < 20 ? 'LOW' : npc.bio.ATP > 70 ? 'HIGH' : 'MID';
        const hunger = npc.bio.GLUC < 20 ? 'HUNGRY' : 'FED';
        const attack = npc.underAttack ? 'DANGER' : 'SAFE';
        const job = npc.job;
        return `${job}|${energy}|${hunger}|${attack}`;
    }

    chooseAction(state, availableActions, fallbackAction) {
        if (!this.q.has(state)) {
            this.q.set(state, {});
        }
        const stateTable = this.q.get(state);

        if (Math.random() < this.epsilon) {
            return availableActions[Math.floor(Math.random() * availableActions.length)];
        }

        let best = fallbackAction;
        let bestScore = stateTable[best] ?? -Infinity;
        availableActions.forEach(action => {
            const score = stateTable[action] ?? (action === fallbackAction ? 0 : -0.1);
            if (score > bestScore) {
                best = action;
                bestScore = score;
            }
        });
        return best;
    }

    update(prevState, action, reward, nextState) {
        if (!prevState || !action) return;
        if (!this.q.has(prevState)) this.q.set(prevState, {});
        const table = this.q.get(prevState);
        const prev = table[action] ?? 0;
        const nextMax = nextState && this.q.has(nextState)
            ? Math.max(...Object.values(this.q.get(nextState)))
            : 0;
        table[action] = prev + this.alpha * (reward + this.gamma * nextMax - prev);
    }
}
