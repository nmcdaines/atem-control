import { ActionType } from './index';
export var EDirection;
(function (EDirection) {
    EDirection["ON"] = "ON";
    EDirection["OFF"] = "OFF";
})(EDirection || (EDirection = {}));
export class ActionSetPiP {
    constructor(props) {
        this.getMessage = () => {
            return {
                type: this.type,
                properties: this.properties,
            };
        };
        this.type = ActionType.SET_PIP;
        this.properties = props;
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiQWN0aW9uU2V0UGlQLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vc3JjL2FjdGlvbnMvQWN0aW9uU2V0UGlQLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBLE9BQU8sRUFBQyxVQUFVLEVBQVUsTUFBTSxTQUFTLENBQUM7QUFFNUMsTUFBTSxDQUFOLElBQVksVUFHWDtBQUhELFdBQVksVUFBVTtJQUNwQix1QkFBUyxDQUFBO0lBQ1QseUJBQVcsQ0FBQTtBQUNiLENBQUMsRUFIVyxVQUFVLEtBQVYsVUFBVSxRQUdyQjtBQVVELE1BQU0sT0FBTyxZQUFZO0lBSXZCLFlBQVksS0FBd0I7UUFLcEMsZUFBVSxHQUFHLEdBQUcsRUFBRTtZQUNoQixPQUFPO2dCQUNMLElBQUksRUFBRSxJQUFJLENBQUMsSUFBSTtnQkFDZixVQUFVLEVBQUUsSUFBSSxDQUFDLFVBQVU7YUFDNUIsQ0FBQTtRQUNILENBQUMsQ0FBQTtRQVRDLElBQUksQ0FBQyxJQUFJLEdBQUcsVUFBVSxDQUFDLE9BQU8sQ0FBQztRQUMvQixJQUFJLENBQUMsVUFBVSxHQUFHLEtBQUssQ0FBQztJQUMxQixDQUFDO0NBUUYifQ==