import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PlansService } from '../plans/plans.service';
import { RecurrencesService } from '../recurrences/recurrences.service';
import { composerBriefing, type PointBriefing } from './briefing.util';

export interface Briefing {
  points: PointBriefing[];
}

@Injectable()
export class BriefingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly plans: PlansService,
    private readonly recurrences: RecurrencesService,
  ) {}

  async forUser(userId: string): Promise<Briefing> {
    const [deadlines, proposees, recurrences, usage] = await Promise.all([
      this.prisma.deadline.findMany({
        where: { userId, status: 'a_faire' },
        select: { id: true, title: true, dueDate: true },
        orderBy: { dueDate: 'asc' },
      }),
      this.prisma.document.findMany({
        where: { userId, suggestedDueDate: { not: null } },
        select: { id: true, name: true },
        orderBy: { createdAt: 'desc' },
      }),
      this.recurrences.forUser(userId),
      this.plans.getUsage(userId),
    ]);

    return {
      points: composerBriefing({
        deadlines,
        proposees,
        hausses: recurrences.hausses,
        quota: { used: usage.documents.used, max: usage.documents.max },
      }),
    };
  }
}
