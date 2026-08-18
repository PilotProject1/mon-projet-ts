import { Module } from '@nestjs/common';
import { BackupService } from './backup.service';
import { BackupController } from './backup.controller';
import { BackupDepot } from './backup-depot';

@Module({
  controllers: [BackupController],
  providers: [BackupService, BackupDepot],
  exports: [BackupService],
})
export class BackupModule {}
