"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ActionNoop = void 0;
const index_1 = require("./index");
class ActionNoop {
    constructor() {
        this.getMessage = () => {
            return {
                type: this.type,
                properties: undefined,
            };
        };
        this.type = index_1.ActionType.NOOP;
    }
}
exports.ActionNoop = ActionNoop;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiQWN0aW9uTm9vcC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uL3NyYy9hY3Rpb25zL0FjdGlvbk5vb3AudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7O0FBQUEsbUNBQThDO0FBRTlDLE1BQWEsVUFBVTtJQUlyQjtRQUlBLGVBQVUsR0FBRyxHQUFHLEVBQUU7WUFDaEIsT0FBTztnQkFDTCxJQUFJLEVBQUUsSUFBSSxDQUFDLElBQUk7Z0JBQ2YsVUFBVSxFQUFFLFNBQVM7YUFDdEIsQ0FBQTtRQUNILENBQUMsQ0FBQTtRQVJDLElBQUksQ0FBQyxJQUFJLEdBQUcsa0JBQVUsQ0FBQyxJQUFJLENBQUM7SUFDOUIsQ0FBQztDQVFGO0FBZEQsZ0NBY0MifQ==