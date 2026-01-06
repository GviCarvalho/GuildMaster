class Entity {
    constructor(x, y) {
        this.x = x;
        this.y = y;
    }

    dist(e) {
        return Math.hypot(this.x - e.x, this.y - e.y);
    }
}
