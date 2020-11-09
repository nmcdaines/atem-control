import { ActionType } from './index';
export class ActionSetProgram {
    constructor(props) {
        this.getMessage = () => {
            return {
                type: this.type,
                properties: this.properties,
            };
        };
        this.type = ActionType.SET_PROGRAM;
        this.properties = props;
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiQWN0aW9uU2V0UHJvZ3JhbS5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uL3NyYy9hY3Rpb25zL0FjdGlvblNldFByb2dyYW0udHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUEsT0FBTyxFQUFFLFVBQVUsRUFBVyxNQUFNLFNBQVMsQ0FBQztBQU05QyxNQUFNLE9BQU8sZ0JBQWdCO0lBSTNCLFlBQVksS0FBNEI7UUFLeEMsZUFBVSxHQUFHLEdBQUcsRUFBRTtZQUNoQixPQUFPO2dCQUNMLElBQUksRUFBRSxJQUFJLENBQUMsSUFBSTtnQkFDZixVQUFVLEVBQUUsSUFBSSxDQUFDLFVBQVU7YUFDNUIsQ0FBQTtRQUNILENBQUMsQ0FBQTtRQVRDLElBQUksQ0FBQyxJQUFJLEdBQUcsVUFBVSxDQUFDLFdBQVcsQ0FBQztRQUNuQyxJQUFJLENBQUMsVUFBVSxHQUFHLEtBQUssQ0FBQztJQUMxQixDQUFDO0NBUUYifQ==