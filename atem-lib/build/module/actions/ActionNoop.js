import { ActionType } from './index';
export class ActionNoop {
    constructor() {
        this.getMessage = () => {
            return {
                type: this.type,
                properties: undefined,
            };
        };
        this.type = ActionType.NOOP;
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiQWN0aW9uTm9vcC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uL3NyYy9hY3Rpb25zL0FjdGlvbk5vb3AudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUEsT0FBTyxFQUFFLFVBQVUsRUFBVyxNQUFNLFNBQVMsQ0FBQztBQUU5QyxNQUFNLE9BQU8sVUFBVTtJQUlyQjtRQUlBLGVBQVUsR0FBRyxHQUFHLEVBQUU7WUFDaEIsT0FBTztnQkFDTCxJQUFJLEVBQUUsSUFBSSxDQUFDLElBQUk7Z0JBQ2YsVUFBVSxFQUFFLFNBQVM7YUFDdEIsQ0FBQTtRQUNILENBQUMsQ0FBQTtRQVJDLElBQUksQ0FBQyxJQUFJLEdBQUcsVUFBVSxDQUFDLElBQUksQ0FBQztJQUM5QixDQUFDO0NBUUYifQ==