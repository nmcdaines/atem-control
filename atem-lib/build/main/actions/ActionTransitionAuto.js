"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ActionTransitionAuto = void 0;
const index_1 = require("./index");
class ActionTransitionAuto {
    constructor(props) {
        this.getMessage = () => {
            return {
                type: this.type,
                properties: this.properties,
            };
        };
        this.type = index_1.ActionType.TRANSITION_AUTO;
        this.properties = props;
    }
}
exports.ActionTransitionAuto = ActionTransitionAuto;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiQWN0aW9uVHJhbnNpdGlvbkF1dG8uanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi9zcmMvYWN0aW9ucy9BY3Rpb25UcmFuc2l0aW9uQXV0by50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7QUFBQSxtQ0FBOEM7QUFNOUMsTUFBYSxvQkFBb0I7SUFJL0IsWUFBWSxLQUFnQztRQUs1QyxlQUFVLEdBQUcsR0FBRyxFQUFFO1lBQ2hCLE9BQU87Z0JBQ0wsSUFBSSxFQUFFLElBQUksQ0FBQyxJQUFJO2dCQUNmLFVBQVUsRUFBRSxJQUFJLENBQUMsVUFBVTthQUM1QixDQUFBO1FBQ0gsQ0FBQyxDQUFBO1FBVEMsSUFBSSxDQUFDLElBQUksR0FBRyxrQkFBVSxDQUFDLGVBQWUsQ0FBQztRQUN2QyxJQUFJLENBQUMsVUFBVSxHQUFHLEtBQUssQ0FBQztJQUMxQixDQUFDO0NBUUY7QUFmRCxvREFlQyJ9