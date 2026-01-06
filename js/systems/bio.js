class BioSystem {
    static tick(npc) {
        npc.bio.ATP -= 0.3;
        npc.bio.H2O -= 0.15;
        npc.bio.GLUC -= 0.1;
        if (npc.bio.GLUC > 0) {
            npc.bio.GLUC -= 0.1;
            npc.bio.ATP += 0.6;
        } else if (npc.bio.FAT > 0) {
            npc.bio.FAT -= 0.1;
            npc.bio.ATP += 0.4;
        } else if (npc.bio.PROT > 0) {
            npc.bio.PROT -= 0.3;
            npc.bio.ATP += 0.3;
            npc.neuro.CRT += 0.5;
        }

        npc.bio.ATP = Math.min(SUBSTANCES.ATP.max, npc.bio.ATP);
        npc.bio.GLUC = Math.min(SUBSTANCES.GLUC.max, npc.bio.GLUC);

        if (npc.bio.H2O <= 0 || npc.bio.PROT <= 0) return false;
        return true;
    }
}
