import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  create(userId: string, deadlineId: string, message: string) {
    return this.prisma.notification.create({
      data: { userId, deadlineId, message, channel: 'in_app' },
    });
  }

  findAll(userId: string) {
    return this.prisma.notification.findMany({
      where: { userId },
      orderBy: { sentAt: 'desc' },
    });
  }

  async markRead(id: string, userId: string) {
    const notification = await this.prisma.notification.findUnique({
      where: { id },
    });
    if (!notification) {
      throw new NotFoundException(`Notification ${id} introuvable`);
    }
    if (notification.userId !== userId) {
      throw new ForbiddenException(
        "Vous n'avez pas accès à cette notification",
      );
    }
    return this.prisma.notification.update({
      where: { id },
      data: { readAt: new Date() },
    });
  }
}
