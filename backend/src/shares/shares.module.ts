import { Module } from '@nestjs/common';
import { SharesController } from './shares.controller';
import { PublicSharesController } from './public-shares.controller';
import { SharesService } from './shares.service';
import { StorageModule } from '../storage/storage.module';

@Module({
  imports: [StorageModule],
  controllers: [SharesController, PublicSharesController],
  providers: [SharesService],
})
export class SharesModule {}
