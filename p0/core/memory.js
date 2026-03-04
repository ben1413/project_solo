"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MemoryNode = void 0;
class MemoryNode {
    async commit(unit) {
        console.log(`Committing memory ${unit.id} with authority: ${unit.authority}`);
    }
}
exports.MemoryNode = MemoryNode;
//# sourceMappingURL=memory.js.map