class Resource extends Entity {
    constructor(type, x, y) {
        super(x, y);
        this.type = type;
        this.amt = 50;
        this.ownerID = null;
    }
}

class Stockpile extends Entity {
    constructor(x, y, ownerID, color) {
        super(x, y);
        this.ownerID = ownerID;
        this.color = color;
    }
}
