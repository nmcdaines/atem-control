"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EDirection = exports.ActionTransitionAuto = exports.ActionSetPiP = exports.ActionSetPreview = exports.ActionSetProgram = exports.ActionNoop = exports.objectToAction = exports.ActionType = void 0;
const ActionNoop_1 = require("./ActionNoop");
Object.defineProperty(exports, "ActionNoop", { enumerable: true, get: function () { return ActionNoop_1.ActionNoop; } });
const ActionSetPiP_1 = require("./ActionSetPiP");
Object.defineProperty(exports, "ActionSetPiP", { enumerable: true, get: function () { return ActionSetPiP_1.ActionSetPiP; } });
Object.defineProperty(exports, "EDirection", { enumerable: true, get: function () { return ActionSetPiP_1.EDirection; } });
const ActionSetPreview_1 = require("./ActionSetPreview");
Object.defineProperty(exports, "ActionSetPreview", { enumerable: true, get: function () { return ActionSetPreview_1.ActionSetPreview; } });
const ActionSetProgram_1 = require("./ActionSetProgram");
Object.defineProperty(exports, "ActionSetProgram", { enumerable: true, get: function () { return ActionSetProgram_1.ActionSetProgram; } });
const ActionTransitionAuto_1 = require("./ActionTransitionAuto");
Object.defineProperty(exports, "ActionTransitionAuto", { enumerable: true, get: function () { return ActionTransitionAuto_1.ActionTransitionAuto; } });
var ActionType;
(function (ActionType) {
    ActionType["SET_PROGRAM"] = "SET_PROGRAM";
    ActionType["SET_PREVIEW"] = "SET_PREVIEW";
    ActionType["TRANSITION_AUTO"] = "TRANSITION_AUTO";
    ActionType["TRANSITION_CUT"] = "TRANSITION_CUT";
    ActionType["SET_PIP"] = "SET_PIP";
    ActionType["RECALL_SHORTCUTE"] = "RECALL_SHORTCUT";
    ActionType["RECALL_MACRO"] = "RECALL_MACRO";
    ActionType["NOOP"] = "NOOP";
})(ActionType = exports.ActionType || (exports.ActionType = {}));
// TODO: Implement a Noop action
function objectToAction(type, properties) {
    // FoundAction is either an IAction or empty
    const FoundAction = {
        [ActionType.SET_PROGRAM]: ActionSetProgram_1.ActionSetProgram,
        [ActionType.SET_PREVIEW]: ActionSetProgram_1.ActionSetProgram,
    }[type];
    return FoundAction
        ? new FoundAction(properties)
        : new ActionNoop_1.ActionNoop();
}
exports.objectToAction = objectToAction;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5kZXguanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi9zcmMvYWN0aW9ucy9pbmRleC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7QUFBQSw2Q0FBMEM7QUF5Q3hDLDJGQXpDTyx1QkFBVSxPQXlDUDtBQXhDWixpREFBMEQ7QUEyQ3hELDZGQTNDTywyQkFBWSxPQTJDUDtBQUVaLDJGQTdDcUIseUJBQVUsT0E2Q3JCO0FBNUNaLHlEQUFzRDtBQXlDcEQsaUdBekNPLG1DQUFnQixPQXlDUDtBQXhDbEIseURBQXNEO0FBdUNwRCxpR0F2Q08sbUNBQWdCLE9BdUNQO0FBdENsQixpRUFBOEQ7QUF5QzVELHFHQXpDTywyQ0FBb0IsT0F5Q1A7QUF2Q3RCLElBQVksVUFXWDtBQVhELFdBQVksVUFBVTtJQUNwQix5Q0FBMkIsQ0FBQTtJQUMzQix5Q0FBMkIsQ0FBQTtJQUMzQixpREFBbUMsQ0FBQTtJQUNuQywrQ0FBaUMsQ0FBQTtJQUNqQyxpQ0FBbUIsQ0FBQTtJQUVuQixrREFBb0MsQ0FBQTtJQUNwQywyQ0FBNkIsQ0FBQTtJQUU3QiwyQkFBYSxDQUFBO0FBQ2YsQ0FBQyxFQVhXLFVBQVUsR0FBVixrQkFBVSxLQUFWLGtCQUFVLFFBV3JCO0FBU0QsZ0NBQWdDO0FBQ2hDLFNBQWdCLGNBQWMsQ0FBQyxJQUFZLEVBQUUsVUFBZTtJQUMxRCw0Q0FBNEM7SUFDNUMsTUFBTSxXQUFXLEdBQUc7UUFDbEIsQ0FBQyxVQUFVLENBQUMsV0FBVyxDQUFDLEVBQUUsbUNBQWdCO1FBQzFDLENBQUMsVUFBVSxDQUFDLFdBQVcsQ0FBQyxFQUFFLG1DQUFnQjtLQUMzQyxDQUFDLElBQUksQ0FBQyxDQUFDO0lBRVIsT0FBTyxXQUFXO1FBQ2hCLENBQUMsQ0FBQyxJQUFJLFdBQVcsQ0FBQyxVQUFVLENBQUM7UUFDN0IsQ0FBQyxDQUFDLElBQUksdUJBQVUsRUFBRSxDQUFDO0FBQ3ZCLENBQUM7QUFWRCx3Q0FVQyJ9