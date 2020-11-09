"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ActionTransitionCut = void 0;
const index_1 = require("./index");
class ActionTransitionCut {
    constructor(props) {
        this.getMessage = () => {
            return {
                type: this.type,
                properties: this.properties,
            };
        };
        this.type = index_1.ActionType.TRANSITION_CUT;
        this.properties = props;
    }
}
exports.ActionTransitionCut = ActionTransitionCut;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiQWN0aW9uVHlwZXNjcmlwdEN1dC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uL3NyYy9hY3Rpb25zL0FjdGlvblR5cGVzY3JpcHRDdXQudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7O0FBQUEsbUNBQThDO0FBTTlDLE1BQWEsbUJBQW1CO0lBSTlCLFlBQVksS0FBK0I7UUFLM0MsZUFBVSxHQUFHLEdBQUcsRUFBRTtZQUNoQixPQUFPO2dCQUNMLElBQUksRUFBRSxJQUFJLENBQUMsSUFBSTtnQkFDZixVQUFVLEVBQUUsSUFBSSxDQUFDLFVBQVU7YUFDNUIsQ0FBQTtRQUNILENBQUMsQ0FBQTtRQVRDLElBQUksQ0FBQyxJQUFJLEdBQUcsa0JBQVUsQ0FBQyxjQUFjLENBQUM7UUFDdEMsSUFBSSxDQUFDLFVBQVUsR0FBRyxLQUFLLENBQUM7SUFDMUIsQ0FBQztDQVFGO0FBZkQsa0RBZUMifQ==