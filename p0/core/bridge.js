"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.initializeBridge = void 0;
const memory_1 = require("./memory");
const initializeBridge = () => {
    const node = new memory_1.MemoryNode();
    console.log("P0 Bridge: Online. Monitoring Memory Authority...");
    return node;
};
exports.initializeBridge = initializeBridge;
//# sourceMappingURL=bridge.js.map