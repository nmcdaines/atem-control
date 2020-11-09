import { ActionType } from './index';
export class ActionTransitionAuto {
    constructor(props) {
        this.getMessage = () => {
            return {
                type: this.type,
                properties: this.properties,
            };
        };
        this.type = ActionType.TRANSITION_AUTO;
        this.properties = props;
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiQWN0aW9uVHJhbnNpdGlvbkF1dG8uanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi9zcmMvYWN0aW9ucy9BY3Rpb25UcmFuc2l0aW9uQXV0by50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQSxPQUFPLEVBQUUsVUFBVSxFQUFXLE1BQU0sU0FBUyxDQUFDO0FBTTlDLE1BQU0sT0FBTyxvQkFBb0I7SUFJL0IsWUFBWSxLQUFnQztRQUs1QyxlQUFVLEdBQUcsR0FBRyxFQUFFO1lBQ2hCLE9BQU87Z0JBQ0wsSUFBSSxFQUFFLElBQUksQ0FBQyxJQUFJO2dCQUNmLFVBQVUsRUFBRSxJQUFJLENBQUMsVUFBVTthQUM1QixDQUFBO1FBQ0gsQ0FBQyxDQUFBO1FBVEMsSUFBSSxDQUFDLElBQUksR0FBRyxVQUFVLENBQUMsZUFBZSxDQUFDO1FBQ3ZDLElBQUksQ0FBQyxVQUFVLEdBQUcsS0FBSyxDQUFDO0lBQzFCLENBQUM7Q0FRRiJ9