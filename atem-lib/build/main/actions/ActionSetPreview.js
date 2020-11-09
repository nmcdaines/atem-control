"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ActionSetPreview = void 0;
const index_1 = require("./index");
class ActionSetPreview {
    constructor(props) {
        this.getMessage = () => {
            return {
                type: this.type,
                properties: this.properties,
            };
        };
        this.type = index_1.ActionType.SET_PREVIEW;
        this.properties = props;
    }
}
exports.ActionSetPreview = ActionSetPreview;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiQWN0aW9uU2V0UHJldmlldy5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uL3NyYy9hY3Rpb25zL0FjdGlvblNldFByZXZpZXcudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7O0FBQUEsbUNBQThDO0FBTTlDLE1BQWEsZ0JBQWdCO0lBSTNCLFlBQVksS0FBNEI7UUFLeEMsZUFBVSxHQUFHLEdBQUcsRUFBRTtZQUNoQixPQUFPO2dCQUNMLElBQUksRUFBRSxJQUFJLENBQUMsSUFBSTtnQkFDZixVQUFVLEVBQUUsSUFBSSxDQUFDLFVBQVU7YUFDNUIsQ0FBQTtRQUNILENBQUMsQ0FBQTtRQVRDLElBQUksQ0FBQyxJQUFJLEdBQUcsa0JBQVUsQ0FBQyxXQUFXLENBQUM7UUFDbkMsSUFBSSxDQUFDLFVBQVUsR0FBRyxLQUFLLENBQUM7SUFDMUIsQ0FBQztDQVFGO0FBZkQsNENBZUMifQ==