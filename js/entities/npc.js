class NPC extends Entity {
    constructor(id) {
        super(Math.random() * 800, Math.random() * 600);
        this.id = id;
        this.brain = new QLearningBrain(ACTIONS);
        this.reset();
    }

    reset() {
        this.alive = true;
        this.job = Object.keys(JOBS)[Math.floor(Math.random() * 3)];
        this.bio = { H2O: 1500, PROT: 500, FAT: 400, GLUC: 80, ATP: 100 };
        this.neuro = { ADR: 0, CRT: 0, OXY: 0 };
        this.inv = { GOLD: 20, PAO: 0 };
        Object.values(JOBS).forEach(job => {
            this.inv[job.raw] = 0;
            this.inv[job.prod] = 0;
        });
        this.activeTraits = [];
        this.action = 'IDLE';
        this.target = null;
        this.underAttack = false;
        this.stockpile = new Stockpile(this.x, this.y, this.id, JOBS[this.job].color);
        stockpiles.push(this.stockpile);
    }

    update() {
        if (!this.alive) return;
        const previousState = this.brain.getState(this);
        const previousAction = this.action;

        this.alive = BioSystem.tick(this);
        NeuroSystem.tick(this);
        if (!this.alive) {
            worldStats.deaths++;
            this.brain.update(previousState, previousAction, -10, null);
            return;
        }

        this.underAttack = false;
        if (Math.random() < 0.1) this.action = AISystem.decide(this);
        this.execute();

        const reward = AISystem.evaluateReward(this);
        const nextState = this.brain.getState(this);
        this.brain.update(previousState, previousAction, reward, nextState);
    }

    moveTo(target, onReach) {
        if (!target) return;

        const d = this.dist(target);
        const stopDist = 5;

        if (d > stopDist) {
            const safeD = d < 0.1 ? 0.1 : d;
            this.x += ((target.x - this.x) / safeD) * 2;
            this.y += ((target.y - this.y) / safeD) * 2;
            this.bio.ATP -= 0.05;
            if (isNaN(this.x)) this.x = Math.random() * 800;
            if (isNaN(this.y)) this.y = Math.random() * 600;
        } else {
            onReach();
        }
    }

    execute() {
        const job = JOBS[this.job];

        if (this.action === 'GATHER') {
            if (!this.target || this.target.amt <= 0) {
                this.target = resources.find(r => r.type === job.target && r.amt > 0);
            }

            if (this.target) {
                this.moveTo(this.target, () => {
                    if (this.target.ownerID !== null && this.target.ownerID !== this.id) {
                        const owner = npcs.find(n => n.id === this.target.ownerID);
                        if (owner && owner.alive && owner.dist(this) < 100) {
                            owner.neuro.ADR += 20;
                            owner.underAttack = true;
                            worldStats.crimes++;
                            createPopup(this.x, this.y, 'ROUBO!', 'red');
                        }
                    } else if (this.target.ownerID === null) {
                        this.target.ownerID = this.id;
                    }

                    this.target.amt--;
                    this.inv[job.raw]++;
                    this.bio.ATP -= 2;
                    this.bio.H2O -= 1;
                    if (this.target.amt <= 0) this.target = null;
                });
            }
        } else if (this.action === 'REFINE') {
            this.moveTo(this.stockpile, () => {
                if (this.inv[job.raw] > 0) {
                    this.inv[job.raw]--;
                    this.inv[job.prod]++;
                    this.bio.ATP -= 3;
                }
            });
        } else if (this.action === 'TRADE') {
            if (!this.target || !this.target.alive) this.target = npcs.find(n => n !== this && n.alive);

            if (this.target) {
                this.moveTo(this.target, () => {
                    if (this.target.inv.GOLD >= 10 && this.inv[job.prod] > 0) {
                        this.inv[job.prod]--;
                        this.inv.GOLD += 10;
                        this.target.inv[job.prod]++;
                        this.target.inv.GOLD -= 10;
                        this.neuro.OXY += 5;
                        createPopup(this.x, this.y, '$$$', '#f1c40f');
                    }
                });
            }
        } else if (this.action === 'SLEEP') {
            this.bio.ATP += 2;
            this.neuro.CRT -= 0.5;
        } else if (this.action === 'EAT') {
            if (this.inv.PAO > 0) {
                this.inv.PAO--;
                this.bio.GLUC += 50;
                this.bio.FAT += 10;
                createPopup(this.x, this.y, 'NHAC', '#2ecc71');
            } else if (this.inv.GOLD >= 5) {
                this.inv.GOLD -= 5;
                this.bio.GLUC += 40;
            }
        } else if (this.action === 'FIGHT') {
            const enemy = npcs.find(n => n !== this && n.alive && this.dist(n) < 20);
            if (enemy) {
                enemy.bio.PROT -= 10;
                enemy.bio.H2O -= 10;
                enemy.neuro.CRT += 20;
                this.neuro.ADR += 10;
                createPopup(enemy.x, enemy.y, 'POW', 'red');
            }
        } else if (this.action === 'FLEE') {
            this.x += (Math.random() - 0.5) * 5;
            this.y += (Math.random() - 0.5) * 5;
            this.bio.ATP -= 1;
        }
    }
}
