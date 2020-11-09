"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ActionSetPiP = exports.EDirection = void 0;
const index_1 = require("./index");
var EDirection;
(function (EDirection) {
    EDirection["ON"] = "ON";
    EDirection["OFF"] = "OFF";
})(EDirection = exports.EDirection || (exports.EDirection = {}));
class ActionSetPiP {
    constructor(props) {
        this.getMessage = () => {
            return {
                type: this.type,
                properties: this.properties,
            };
        };
        this.type = index_1.ActionType.SET_PIP;
        this.properties = props;
    }
}
exports.ActionSetPiP = ActionSetPiP;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiQWN0aW9uU2V0UGlQLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vc3JjL2FjdGlvbnMvQWN0aW9uU2V0UGlQLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7OztBQUFBLG1DQUE0QztBQUU1QyxJQUFZLFVBR1g7QUFIRCxXQUFZLFVBQVU7SUFDcEIsdUJBQVMsQ0FBQTtJQUNULHlCQUFXLENBQUE7QUFDYixDQUFDLEVBSFcsVUFBVSxHQUFWLGtCQUFVLEtBQVYsa0JBQVUsUUFHckI7QUFVRCxNQUFhLFlBQVk7SUFJdkIsWUFBWSxLQUF3QjtRQUtwQyxlQUFVLEdBQUcsR0FBRyxFQUFFO1lBQ2hCLE9BQU87Z0JBQ0wsSUFBSSxFQUFFLElBQUksQ0FBQyxJQUFJO2dCQUNmLFVBQVUsRUFBRSxJQUFJLENBQUMsVUFBVTthQUM1QixDQUFBO1FBQ0gsQ0FBQyxDQUFBO1FBVEMsSUFBSSxDQUFDLElBQUksR0FBRyxrQkFBVSxDQUFDLE9BQU8sQ0FBQztRQUMvQixJQUFJLENBQUMsVUFBVSxHQUFHLEtBQUssQ0FBQztJQUMxQixDQUFDO0NBUUY7QUFmRCxvQ0FlQyJ9