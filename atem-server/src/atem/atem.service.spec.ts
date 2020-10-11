import { Test, TestingModule } from '@nestjs/testing';
import { AtemService } from './atem.service';

describe('AtemService', () => {
  let service: AtemService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [AtemService],
    }).compile();

    service = module.get<AtemService>(AtemService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
