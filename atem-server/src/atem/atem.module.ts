import { Module } from '@nestjs/common';
import { AtemService } from './atem.service';

@Module({
    imports: [],
    providers: [AtemService],
    exports: [AtemService],
})
export class AtemModule {}
