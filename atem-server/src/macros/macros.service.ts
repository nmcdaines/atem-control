import {Injectable, Logger} from '@nestjs/common';
import {ActionsService} from "../actions/actions.service";
import {DevicesService} from "../devices/devices.service";
import {Macro} from "./macro.entity";
import {InjectRepository} from "@nestjs/typeorm";
import {Repository} from "typeorm";

@Injectable()
export class MacrosService {
  private readonly logger: Logger = new Logger('MacrosService');

  constructor(
    @InjectRepository(Macro)
    private macroRepository: Repository<Macro>,
    private devicesService: DevicesService,
    private actionsService: ActionsService,
  ) {}

  listMacro() {
    return this.macroRepository.find();
  }

  getMacro(id: string) {
    return this.macroRepository.findOne({ id });
  }

  createMacro(macro: Macro) {
    return this.macroRepository.insert(macro);
  }

  updateMacro(id: string, changes: Partial<Macro>) {
    return this.macroRepository.update(id, changes);
  }

  deleteMacro(id: string) {
    return this.macroRepository.delete(id);
  }

  runMacro(macro: Macro) {
    this.logger.log('[runMacro] to be implemented');
  }
}
