"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EDirection = exports.ActionTransitionAuto = exports.ActionSetPiP = exports.ActionSetPreview = exports.ActionSetProgram = exports.ActionType = void 0;
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
})(ActionType = exports.ActionType || (exports.ActionType = {}));
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5kZXguanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi9zcmMvYWN0aW9ucy9pbmRleC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7QUFBQSxpREFBMEQ7QUF5QnhELDZGQXpCTywyQkFBWSxPQXlCUDtBQUVaLDJGQTNCcUIseUJBQVUsT0EyQnJCO0FBMUJaLHlEQUFzRDtBQXVCcEQsaUdBdkJPLG1DQUFnQixPQXVCUDtBQXRCbEIseURBQXNEO0FBcUJwRCxpR0FyQk8sbUNBQWdCLE9BcUJQO0FBcEJsQixpRUFBOEQ7QUF1QjVELHFHQXZCTywyQ0FBb0IsT0F1QlA7QUFyQnRCLElBQVksVUFTWDtBQVRELFdBQVksVUFBVTtJQUNwQix5Q0FBMkIsQ0FBQTtJQUMzQix5Q0FBMkIsQ0FBQTtJQUMzQixpREFBbUMsQ0FBQTtJQUNuQywrQ0FBaUMsQ0FBQTtJQUNqQyxpQ0FBbUIsQ0FBQTtJQUVuQixrREFBb0MsQ0FBQTtJQUNwQywyQ0FBNkIsQ0FBQTtBQUMvQixDQUFDLEVBVFcsVUFBVSxHQUFWLGtCQUFVLEtBQVYsa0JBQVUsUUFTckIifQ==