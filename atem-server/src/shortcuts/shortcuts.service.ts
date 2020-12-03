import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Shortcut } from './shortcut.entity';

@Injectable()
export class ShortcutsService {
  private readonly logger: Logger = new Logger('ShortcutsService');

  constructor(
    @InjectRepository(Shortcut)
    private shortcutRespository: Repository<Shortcut>,
  ) {}

  listShortcuts() {
    return this.shortcutRespository.find();
  }

  getShortcut(id: string) {
    return this.shortcutRespository.findOne({ id });
  }

  createShortcut(shortcut: Shortcut) {
    return this.shortcutRespository.insert(shortcut);
  }

  updateShortcut(id: string, shortcut: Partial<Shortcut>) {
    return this.shortcutRespository.update(id, shortcut);
  }

  deleteShortcut(id: string) {
    return this.shortcutRespository.delete(id);
  }
}
